import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ReadinessMaterialPlan } from './entities/readiness-material-plan.entity';
import { ReadinessMaterialLine } from './entities/readiness-material-line.entity';
import { ReadinessMaterialPlanRevision } from './entities/readiness-material-plan-revision.entity';
import {
  CopyFromPreviousDto,
  CreateReadinessMaterialPlanDto,
  ListReadinessMaterialsQuery,
  ReadinessReviewDto,
  SaveLinesDto,
  UpdateReadinessMaterialPlanDto,
} from './dto/readiness-material.dto';
import {
  previousState,
  READINESS_STATE_LABEL,
  type ReadinessState,
} from './readiness-material.constants';
import { paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
  transitionWithRevision,
} from '../../common/workflow-transition';

// Trục B — Khai báo & chuyển trạng thái vật chất SSCĐ theo 4 mức (copy-forward từ mức liền dưới
// đã duyệt). Workflow chuẩn DRAFT→PENDING_REVIEW→APPROVED, revision bất biến. Lọc theo data-scope.
@Injectable()
export class ReadinessMaterialsService {
  constructor(
    @InjectRepository(ReadinessMaterialPlan)
    private readonly plans: Repository<ReadinessMaterialPlan>,
    @InjectRepository(ReadinessMaterialLine)
    private readonly lines: Repository<ReadinessMaterialLine>,
    private readonly dataSource: DataSource,
  ) {}

  // ------- Danh sách & chi tiết -------
  async list(q: ListReadinessMaterialsQuery, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.plans
      .createQueryBuilder('p')
      .leftJoin('administrative_areas', 'a', 'a.id = p.area_id')
      .leftJoin('readiness_material_lines', 'rml', 'rml.plan_id = p.id')
      .select('p.id', 'id')
      .addSelect('p.area_id', 'areaId')
      .addSelect('a.name', 'areaName')
      .addSelect('p.readiness_state', 'readinessState')
      .addSelect('p.workflow_status', 'workflowStatus')
      .addSelect('p.copied_from_state', 'copiedFromState')
      .addSelect('p.updated_at', 'updatedAt')
      .addSelect('COUNT(rml.id)', 'lineCount')
      .groupBy('p.id')
      .addGroupBy('a.name')
      .orderBy('a.name', 'ASC')
      .addOrderBy('p.readiness_state', 'ASC')
      .offset(q.skip)
      .limit(q.size);
    const countQb = this.plans.createQueryBuilder('p');
    for (const b of [qb, countQb]) {
      if (q.areaId) b.andWhere('p.area_id = :area', { area: q.areaId });
      if (q.readinessState) b.andWhere('p.readiness_state = :st', { st: q.readinessState });
      if (q.status) b.andWhere('p.workflow_status = :ws', { ws: q.status });
      if (scope)
        b.andWhere('(p.area_id = ANY(:areaIds::uuid[]) OR p.organization_id = :orgId)', {
          areaIds: scope.areaIds,
          orgId: scope.organizationId,
        });
    }
    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    const data = rows.map((r) => ({ ...r, lineCount: Number(r.lineCount) }));
    return paginated(data, total, q);
  }

  private async getPlan(id: string): Promise<ReadinessMaterialPlan> {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy bản khai báo SSCĐ');
    return p;
  }

  // Chi tiết bản + tên xã + dòng (kèm mã/tên vật chất, tổng theo cấp).
  async get(id: string) {
    const plan = await this.getPlan(id);
    const areaRow = await this.dataSource.query(
      'SELECT name FROM administrative_areas WHERE id = $1',
      [plan.areaId],
    );
    const lineRows = await this.dataSource.query(
      `SELECT rml.id, rml.material_id AS "materialId", m.code AS "materialCode", m.name AS "materialName",
              COALESCE(rml.unit_code, m.unit_code) AS "unitCode",
              rml.qty_grade_1 AS "qtyGrade1", rml.qty_grade_2 AS "qtyGrade2", rml.qty_grade_3 AS "qtyGrade3",
              rml.qty_grade_4 AS "qtyGrade4", rml.qty_grade_5 AS "qtyGrade5",
              rml.note, rml.sort_order AS "sortOrder"
       FROM readiness_material_lines rml
       LEFT JOIN materials m ON m.id = rml.material_id
       WHERE rml.plan_id = $1
       ORDER BY rml.sort_order ASC, m.code ASC`,
      [id],
    );
    const lines = lineRows.map((r: Record<string, string>) => {
      const g = [r.qtyGrade1, r.qtyGrade2, r.qtyGrade3, r.qtyGrade4, r.qtyGrade5].map(Number);
      return {
        id: r.id,
        materialId: r.materialId,
        materialCode: r.materialCode,
        materialName: r.materialName,
        unitCode: r.unitCode,
        qtyGrade1: g[0],
        qtyGrade2: g[1],
        qtyGrade3: g[2],
        qtyGrade4: g[3],
        qtyGrade5: g[4],
        total: g.reduce((s, x) => s + x, 0),
        note: r.note,
        sortOrder: Number(r.sortOrder),
      };
    });
    return { ...plan, areaName: areaRow[0]?.name ?? null, lines };
  }

  async listRevisions(id: string) {
    await this.getPlan(id);
    return this.dataSource
      .getRepository(ReadinessMaterialPlanRevision)
      .find({ where: { planId: id }, order: { revisionNo: 'DESC' } });
  }

  // ------- Tạo / sửa header -------
  async createPlan(dto: CreateReadinessMaterialPlanDto, user: AuthUser) {
    this.assertAreaInScope(dto.areaId, user);
    const dup = await this.plans.findOne({
      where: { areaId: dto.areaId, readinessState: dto.readinessState },
    });
    if (dup) {
      throw new ConflictException(
        `DATA-003: Xã đã có bản khai báo mức "${READINESS_STATE_LABEL[dto.readinessState as ReadinessState]}"`,
      );
    }
    return this.plans.save(
      this.plans.create({
        areaId: dto.areaId,
        readinessState: dto.readinessState,
        organizationId: dto.organizationId ?? user.organizationId ?? null,
        workflowStatus: WorkflowStatus.DRAFT,
        notes: dto.notes ?? null,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async updatePlan(id: string, dto: UpdateReadinessMaterialPlanDto, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertEditable(plan.workflowStatus);
    if (dto.notes !== undefined) plan.notes = dto.notes;
    plan.updatedBy = user.sub;
    return this.plans.save(plan);
  }

  // Lưu toàn bộ dòng (thay thế trọn bộ) — chỉ khi bản chưa chốt.
  async saveLines(id: string, dto: SaveLinesDto, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertEditable(plan.workflowStatus, 'sửa dòng');
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(ReadinessMaterialLine);
      await repo.delete({ planId: id });
      const rows = dto.lines.map((l, idx) =>
        repo.create({
          planId: id,
          materialId: l.materialId,
          unitCode: l.unitCode ?? null,
          qtyGrade1: (l.qtyGrade1 ?? 0).toString(),
          qtyGrade2: (l.qtyGrade2 ?? 0).toString(),
          qtyGrade3: (l.qtyGrade3 ?? 0).toString(),
          qtyGrade4: (l.qtyGrade4 ?? 0).toString(),
          qtyGrade5: (l.qtyGrade5 ?? 0).toString(),
          note: l.note ?? null,
          sortOrder: l.sortOrder ?? idx,
        }),
      );
      if (rows.length) await repo.save(rows);
      plan.updatedBy = user.sub;
      await m.getRepository(ReadinessMaterialPlan).save(plan);
    });
    return this.get(id);
  }

  // ------- Copy-forward: sao chép từ mức liền dưới đã duyệt của cùng xã -------
  async copyFromPreviousState(dto: CopyFromPreviousDto, user: AuthUser) {
    const prev = previousState(dto.targetState);
    if (!prev) {
      throw new BadRequestException(
        'WF-001: "Thường xuyên" là mức nền, không có mức dưới để sao chép',
      );
    }
    this.assertAreaInScope(dto.areaId, user);
    const source = await this.plans.findOne({
      where: {
        areaId: dto.areaId,
        readinessState: prev,
        workflowStatus: WorkflowStatus.APPROVED,
      },
    });
    if (!source) {
      throw new NotFoundException(
        `DATA-001: Chưa có bản "${READINESS_STATE_LABEL[prev]}" đã DUYỆT của xã để sao chép`,
      );
    }
    let target = await this.plans.findOne({
      where: { areaId: dto.areaId, readinessState: dto.targetState },
    });
    if (target) {
      assertEditable(target.workflowStatus, 'sao chép vào');
    } else {
      target = await this.plans.save(
        this.plans.create({
          areaId: dto.areaId,
          readinessState: dto.targetState,
          organizationId: user.organizationId ?? null,
          workflowStatus: WorkflowStatus.DRAFT,
          createdBy: user.sub,
          updatedBy: user.sub,
        }),
      );
    }
    const targetId = target.id;
    const sourceLines = await this.lines.find({
      where: { planId: source.id },
      order: { sortOrder: 'ASC' },
    });
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(ReadinessMaterialLine);
      await repo.delete({ planId: targetId });
      if (sourceLines.length) {
        await repo.save(
          sourceLines.map((l) =>
            repo.create({
              planId: targetId,
              materialId: l.materialId,
              unitCode: l.unitCode,
              qtyGrade1: l.qtyGrade1,
              qtyGrade2: l.qtyGrade2,
              qtyGrade3: l.qtyGrade3,
              qtyGrade4: l.qtyGrade4,
              qtyGrade5: l.qtyGrade5,
              note: l.note,
              sortOrder: l.sortOrder,
            }),
          ),
        );
      }
      const t = await m.getRepository(ReadinessMaterialPlan).findOneByOrFail({ id: targetId });
      t.copiedFromState = prev;
      t.copiedFromPlanId = source.id;
      t.updatedBy = user.sub;
      await m.getRepository(ReadinessMaterialPlan).save(t);
    });
    return this.get(targetId);
  }

  // ------- Workflow -------
  async submit(id: string, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertEditable(plan.workflowStatus, 'gửi duyệt');
    return this.transitionPlan(plan, WorkflowStatus.PENDING_REVIEW, user);
  }

  async approve(id: string, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertPendingReview(plan.workflowStatus);
    assertNotSelfApprove(plan.createdBy, user.sub);
    return this.transitionPlan(plan, WorkflowStatus.APPROVED, user);
  }

  async requestChanges(id: string, _dto: ReadinessReviewDto, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertPendingReview(plan.workflowStatus, 'yêu cầu bổ sung');
    return this.transitionPlan(plan, WorkflowStatus.CHANGES_REQUESTED, user);
  }

  // Chuyển trạng thái + ghi revision bất biến (chụp cả header lẫn dòng).
  private async transitionPlan(plan: ReadinessMaterialPlan, to: WorkflowStatus, user: AuthUser) {
    const lines = await this.lines.find({ where: { planId: plan.id }, order: { sortOrder: 'ASC' } });
    return transitionWithRevision(
      {
        dataSource: this.dataSource,
        entityTarget: ReadinessMaterialPlan,
        revisionTarget: ReadinessMaterialPlanRevision,
        fkColumn: 'planId',
        buildPayload: (saved) => ({
          areaId: saved.areaId,
          organizationId: saved.organizationId,
          readinessState: saved.readinessState,
          copiedFromState: saved.copiedFromState,
          notes: saved.notes,
          lines: lines.map((l) => ({
            materialId: l.materialId,
            unitCode: l.unitCode,
            qtyGrade1: l.qtyGrade1,
            qtyGrade2: l.qtyGrade2,
            qtyGrade3: l.qtyGrade3,
            qtyGrade4: l.qtyGrade4,
            qtyGrade5: l.qtyGrade5,
            note: l.note,
            sortOrder: l.sortOrder,
          })),
        }),
      },
      plan,
      to,
      user.sub,
    );
  }

  // Người dùng cấp xã chỉ thao tác trên địa bàn thuộc phạm vi của mình.
  private assertAreaInScope(areaId: string, user: AuthUser) {
    const scope = barracksScope(user);
    if (scope && !scope.areaIds.includes(areaId)) {
      throw new ForbiddenException('AUTH-003: Ngoài phạm vi dữ liệu (xã) của bạn');
    }
  }
}
