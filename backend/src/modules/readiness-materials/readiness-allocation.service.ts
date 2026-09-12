import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ReadinessAllocationPlan } from './entities/readiness-allocation-plan.entity';
import { ReadinessAllocationLine } from './entities/readiness-allocation-line.entity';
import { ReadinessAllocationPlanRevision } from './entities/readiness-allocation-plan-revision.entity';
import {
  CreateAllocationPlanDto,
  ListAllocationQuery,
  SaveAllocationLinesDto,
  UpdateAllocationPlanDto,
} from './dto/readiness-allocation.dto';
import { paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
  transitionWithRevision,
} from '../../common/workflow-transition';

// Feature 03 — Phương án PHÂN CẤP LƯỢNG vật chất SSCĐ (top-down, cấp Tỉnh). Mỗi trạng thái SSCĐ
// là một bảng riêng; mỗi dòng vật chất phân bổ lượng theo 4 cấp (kho Tỉnh/xã/trung đoàn/căn cứ).
@Injectable()
export class ReadinessAllocationService {
  constructor(
    @InjectRepository(ReadinessAllocationPlan)
    private readonly plans: Repository<ReadinessAllocationPlan>,
    @InjectRepository(ReadinessAllocationLine)
    private readonly lines: Repository<ReadinessAllocationLine>,
    private readonly dataSource: DataSource,
  ) {}

  async list(q: ListAllocationQuery) {
    const qb = this.plans
      .createQueryBuilder('p')
      .leftJoin('readiness_allocation_lines', 'l', 'l.plan_id = p.id')
      .select('p.id', 'id')
      .addSelect('p.readiness_state', 'readinessState')
      .addSelect('p.title', 'title')
      .addSelect('p.period_label', 'periodLabel')
      .addSelect('p.workflow_status', 'workflowStatus')
      .addSelect('p.updated_at', 'updatedAt')
      .addSelect('COUNT(l.id)', 'lineCount')
      .addSelect('COALESCE(SUM(l.qty_total), 0)', 'totalQuantity')
      .groupBy('p.id')
      .orderBy('p.readiness_state', 'ASC')
      .addOrderBy('p.period_label', 'DESC')
      .offset(q.skip)
      .limit(q.size);
    const countQb = this.plans.createQueryBuilder('p');
    for (const b of [qb, countQb]) {
      if (q.readinessState) b.andWhere('p.readiness_state = :st', { st: q.readinessState });
      if (q.status) b.andWhere('p.workflow_status = :ws', { ws: q.status });
    }
    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    const data = rows.map((r) => ({
      ...r,
      lineCount: Number(r.lineCount),
      totalQuantity: Number(r.totalQuantity),
    }));
    return paginated(data, total, q);
  }

  private async getPlan(id: string): Promise<ReadinessAllocationPlan> {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy phương án SSCĐ');
    return p;
  }

  async get(id: string) {
    const plan = await this.getPlan(id);
    const lineRows = await this.dataSource.query(
      `SELECT l.id, l.material_catalog_id AS "materialCatalogId",
              mc.code AS "materialCode", mc.name AS "materialName",
              l.unit_id AS "unitId", u.symbol AS "unitSymbol",
              l.qty_kho_tinh AS "qtyKhoTinh", l.qty_xa AS "qtyXa",
              l.qty_trung_doan AS "qtyTrungDoan", l.qty_can_cu AS "qtyCanCu",
              l.qty_total AS "qtyTotal", l.note, l.sort_order AS "sortOrder"
       FROM readiness_allocation_lines l
       LEFT JOIN material_catalog mc ON mc.id = l.material_catalog_id
       LEFT JOIN unit_of_measure u ON u.id = l.unit_id
       WHERE l.plan_id = $1
       ORDER BY l.sort_order ASC, mc.code ASC`,
      [id],
    );
    const lines = (lineRows as Record<string, string>[]).map((r) => ({
      id: r.id,
      materialCatalogId: r.materialCatalogId,
      materialCode: r.materialCode,
      materialName: r.materialName,
      unitId: r.unitId,
      unitSymbol: r.unitSymbol,
      qtyKhoTinh: Number(r.qtyKhoTinh),
      qtyXa: Number(r.qtyXa),
      qtyTrungDoan: Number(r.qtyTrungDoan),
      qtyCanCu: Number(r.qtyCanCu),
      qtyTotal: Number(r.qtyTotal),
      note: r.note,
      sortOrder: Number(r.sortOrder),
    }));
    return { ...plan, lines };
  }

  async listRevisions(id: string) {
    await this.getPlan(id);
    return this.dataSource
      .getRepository(ReadinessAllocationPlanRevision)
      .find({ where: { planId: id }, order: { revisionNo: 'DESC' } });
  }

  async createPlan(dto: CreateAllocationPlanDto, user: AuthUser) {
    const periodLabel = dto.periodLabel ?? null;
    const dup = await this.plans.findOne({
      where: { readinessState: dto.readinessState, periodLabel: periodLabel ?? IsNull() },
    });
    if (dup) {
      throw new ConflictException(
        `DATA-003: Đã có phương án trạng thái "${dto.readinessState}" kỳ "${periodLabel ?? '—'}"`,
      );
    }
    return this.plans.save(
      this.plans.create({
        readinessState: dto.readinessState,
        title: dto.title,
        regulationRef: dto.regulationRef ?? null,
        periodLabel,
        workflowStatus: WorkflowStatus.DRAFT,
        notes: dto.notes ?? null,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async updatePlan(id: string, dto: UpdateAllocationPlanDto, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertEditable(plan.workflowStatus);
    if (dto.title !== undefined) plan.title = dto.title;
    if (dto.regulationRef !== undefined) plan.regulationRef = dto.regulationRef || null;
    if (dto.periodLabel !== undefined) plan.periodLabel = dto.periodLabel || null;
    if (dto.notes !== undefined) plan.notes = dto.notes || null;
    plan.updatedBy = user.sub;
    return this.plans.save(plan);
  }

  // Lưu toàn bộ dòng (thay thế trọn bộ). qtyTotal = tổng 4 cấp.
  async saveLines(id: string, dto: SaveAllocationLinesDto, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertEditable(plan.workflowStatus, 'sửa dòng');
    await this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(ReadinessAllocationLine);
      await repo.delete({ planId: id });
      const rows = dto.lines.map((l, idx) => {
        const k = l.qtyKhoTinh ?? 0;
        const x = l.qtyXa ?? 0;
        const t = l.qtyTrungDoan ?? 0;
        const c = l.qtyCanCu ?? 0;
        return repo.create({
          planId: id,
          materialCatalogId: l.materialCatalogId,
          unitId: l.unitId ?? null,
          qtyKhoTinh: k.toString(),
          qtyXa: x.toString(),
          qtyTrungDoan: t.toString(),
          qtyCanCu: c.toString(),
          qtyTotal: (k + x + t + c).toString(),
          note: l.note ?? null,
          sortOrder: l.sortOrder ?? idx,
          createdBy: user.sub,
          updatedBy: user.sub,
        });
      });
      if (rows.length) await repo.save(rows);
      plan.updatedBy = user.sub;
      await m.getRepository(ReadinessAllocationPlan).save(plan);
    });
    return this.get(id);
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
    plan.lockedAt = new Date();
    plan.lockedBy = user.sub;
    return this.transitionPlan(plan, WorkflowStatus.APPROVED, user);
  }

  async requestChanges(id: string, user: AuthUser) {
    const plan = await this.getPlan(id);
    assertPendingReview(plan.workflowStatus, 'yêu cầu bổ sung');
    plan.lockedAt = null;
    plan.lockedBy = null;
    return this.transitionPlan(plan, WorkflowStatus.CHANGES_REQUESTED, user);
  }

  private async transitionPlan(plan: ReadinessAllocationPlan, to: WorkflowStatus, user: AuthUser) {
    const lines = await this.lines.find({ where: { planId: plan.id }, order: { sortOrder: 'ASC' } });
    return transitionWithRevision(
      {
        dataSource: this.dataSource,
        entityTarget: ReadinessAllocationPlan,
        revisionTarget: ReadinessAllocationPlanRevision,
        fkColumn: 'planId',
        buildPayload: (saved) => ({
          readinessState: saved.readinessState,
          title: saved.title,
          regulationRef: saved.regulationRef,
          periodLabel: saved.periodLabel,
          notes: saved.notes,
          lines: lines.map((l) => ({
            materialCatalogId: l.materialCatalogId,
            unitId: l.unitId,
            qtyKhoTinh: l.qtyKhoTinh,
            qtyXa: l.qtyXa,
            qtyTrungDoan: l.qtyTrungDoan,
            qtyCanCu: l.qtyCanCu,
            qtyTotal: l.qtyTotal,
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
}
