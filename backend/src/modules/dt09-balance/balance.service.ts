import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { BalancePlan } from './entities/balance-plan.entity';
import { BalanceLine } from './entities/balance-line.entity';
import { SourceReservation } from './entities/source-reservation.entity';
import { SourceMaterial } from './entities/source-material.entity';
import { SourceVerification } from './entities/source-verification.entity';
import { MobilizationAssessment } from './entities/mobilization-assessment.entity';
import { ExecutionRequest } from './entities/execution-request.entity';
import { ExecutionFeedback } from './entities/execution-feedback.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from './entities/balance-snapshot.entity';
import {
  BALANCE_PLAN_TRANSITIONS,
  BalancePlanStatus,
  ExecutionStatus,
  ReservationStatus,
} from './dt09.enums';
import {
  CreatePlanDto,
  ExecutionFeedbackDto,
  ExecutionRequestDto,
  ReservationDto,
} from './dto/dt09.dto';
import {
  FingerprintEntry,
  assertReservationWithinAvailable,
  computeBalanceChecksum,
  computeGap,
  round3,
  sourceFingerprint,
} from './balance-rules';
import { assertTransition } from '../../common/enums/assert-transition';
import { assertRowVersion } from '../../common/concurrency/optimistic-lock';
import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { applyJsonOrgScope, assertReadScope } from '../../common/scope/scope-query';
import { CalcService } from '../dt08-calculation/calc.service';
import { DocumentsService } from '../dt05-documents/documents.service';
import { InventoryDocumentType } from '../dt05-documents/dt05.enums';

// DT-09 — Cân đối bảo đảm: nhận supply_required (DT-08), giữ chỗ chống overbooking, execution → DT-05,
// snapshot bất biến khi phê duyệt (Quyển IX §VII/§XVIII).
@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalancePlan) private readonly plans: Repository<BalancePlan>,
    @InjectRepository(BalanceLine) private readonly lines: Repository<BalanceLine>,
    @InjectRepository(SourceReservation) private readonly reservations: Repository<SourceReservation>,
    @InjectRepository(SourceMaterial) private readonly materials: Repository<SourceMaterial>,
    @InjectRepository(SourceVerification) private readonly verifications: Repository<SourceVerification>,
    @InjectRepository(MobilizationAssessment) private readonly mobilizations: Repository<MobilizationAssessment>,
    @InjectRepository(ExecutionRequest) private readonly execRequests: Repository<ExecutionRequest>,
    @InjectRepository(ExecutionFeedback) private readonly feedbacks: Repository<ExecutionFeedback>,
    @InjectRepository(BalanceSnapshot) private readonly snapshots: Repository<BalanceSnapshot>,
    @InjectRepository(BalanceSnapshotLine) private readonly snapshotLines: Repository<BalanceSnapshotLine>,
    private readonly dataSource: DataSource,
    private readonly calc: CalcService,
    private readonly documents: DocumentsService,
  ) {}

  private uid(u: AuthUser): string | null {
    return u?.sub ?? null;
  }

  private assertPlanMutable(plan: BalancePlan): void {
    if (plan.status === BalancePlanStatus.LOCKED) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, `Kế hoạch ${plan.planCode} đã khóa`);
    }
  }

  // ======================= Kế hoạch =======================
  listPlans(q: PaginationQuery, user?: AuthUser) {
    const qb = this.plans.createQueryBuilder('p').orderBy('p.created_at', 'DESC');
    applyJsonOrgScope(qb, 'p', user); // SYS-BR-08: org trong scope_json
    return qb
      .skip(q.skip)
      .take(q.size)
      .getManyAndCount()
      .then(([data, total]) => paginated(data, total, q));
  }

  async getPlan(id: string, user?: AuthUser) {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`DATA-001: Không có kế hoạch ${id}`);
    assertReadScope(undefined, ((plan.scopeJson as Record<string, unknown>)?.organizationId as string) ?? null, user);
    const lines = await this.lines.find({ where: { planId: id }, order: { createdAt: 'ASC' } });
    return { ...plan, lines: lines.map((l) => this.lineView(l)) };
  }

  private async getPlanEntity(id: string): Promise<BalancePlan> {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`DATA-001: Không có kế hoạch ${id}`);
    return plan;
  }

  // Nhận supply_required từ DT-08 (KHÔNG tính lại NC — BR-DT09-009).
  async createPlan(dto: CreatePlanDto, user: AuthUser) {
    const supply = await this.calc.supplyRequired(dto.scenarioRunId);
    const planCode = dto.planCode ?? `BP-${Date.now()}`;
    const dup = await this.plans.findOne({ where: { planCode } });
    if (dup) throw new NotFoundException(`DATA-003: Kế hoạch ${planCode} đã tồn tại`);

    const plan = await this.plans.save(
      this.plans.create({
        planCode,
        name: dto.name,
        scenarioRunId: dto.scenarioRunId,
        status: BalancePlanStatus.DRAFT,
        revisionNo: 1,
        basedOnId: null,
        scopeJson: (dto.scope as Record<string, unknown>) ?? {},
        sourceOutputHash: supply.outputHash ?? null,
        deadlineDays: dto.deadlineDays ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );

    for (const item of supply.items) {
      const sr = round3(Number(item.supplyRequired));
      await this.lines.save(
        this.lines.create({
          planId: plan.id,
          materialCatalogId: item.materialCatalogId,
          unitId: item.unitId ?? null,
          supplyRequired: String(sr),
          plannedSourceQty: '0',
          gapQty: String(sr),
          status: 'OPEN',
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
    }
    return this.getPlan(plan.id);
  }

  // revise = clone (nhất quán DT-08). Bản mới DRAFT, giữ nguyên supply_required, reset giữ chỗ.
  async revise(id: string, user: AuthUser) {
    const base = await this.getPlanEntity(id);
    const baseLines = await this.lines.find({ where: { planId: id } });
    const plan = await this.plans.save(
      this.plans.create({
        planCode: `${base.planCode}-r${base.revisionNo + 1}`,
        name: base.name,
        scenarioRunId: base.scenarioRunId,
        status: BalancePlanStatus.DRAFT,
        revisionNo: base.revisionNo + 1,
        basedOnId: base.id,
        scopeJson: base.scopeJson,
        sourceOutputHash: base.sourceOutputHash,
        deadlineDays: base.deadlineDays,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    for (const l of baseLines) {
      await this.lines.save(
        this.lines.create({
          planId: plan.id,
          materialCatalogId: l.materialCatalogId,
          unitId: l.unitId,
          supplyRequired: l.supplyRequired,
          plannedSourceQty: '0',
          gapQty: l.supplyRequired,
          status: 'OPEN',
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
    }
    return this.getPlan(plan.id);
  }

  // Tổng hợp planned_source_qty (Σ giữ chỗ ACTIVE) → gap từng dòng; chuyển DRAFT→BALANCED.
  async balance(id: string, user: AuthUser) {
    const plan = await this.getPlanEntity(id);
    this.assertPlanMutable(plan);
    const lines = await this.lines.find({ where: { planId: id } });
    for (const line of lines) {
      await this.recomputeLine(line.id, this.dataSource.manager);
    }
    assertTransition(BALANCE_PLAN_TRANSITIONS, plan.status, BalancePlanStatus.BALANCED);
    plan.status = BalancePlanStatus.BALANCED;
    plan.updatedBy = this.uid(user);
    await this.plans.save(plan);
    return this.getPlan(id);
  }

  private async recomputeLine(lineId: string, mgr: EntityManager): Promise<BalanceLine> {
    const line = await mgr.getRepository(BalanceLine).findOne({ where: { id: lineId } });
    if (!line) throw new NotFoundException(`DATA-001: Không có dòng cân đối ${lineId}`);
    const active = await mgr.getRepository(SourceReservation).find({
      where: { balanceLineId: lineId, status: ReservationStatus.ACTIVE },
    });
    const planned = round3(active.reduce((s, r) => s + Number(r.reservedQty), 0));
    const { gap, status } = computeGap(Number(line.supplyRequired), planned);
    line.plannedSourceQty = String(planned);
    line.gapQty = String(gap);
    line.status = status;
    return mgr.getRepository(BalanceLine).save(line);
  }

  // ======================= Giữ chỗ chống overbooking (BR-DT09-008) =======================
  async reserve(balanceLineId: string, dto: ReservationDto, user: AuthUser): Promise<SourceReservation> {
    return this.dataSource.transaction(async (mgr) => {
      const line = await mgr.getRepository(BalanceLine).findOne({ where: { id: balanceLineId } });
      if (!line) throw new NotFoundException(`DATA-001: Không có dòng cân đối ${balanceLineId}`);
      const plan = await mgr.getRepository(BalancePlan).findOne({ where: { id: line.planId } });
      if (plan) this.assertPlanMutable(plan);

      // Khóa ghi hàng source_material để tuần tự hóa các giao dịch giữ chỗ song song.
      const material = await mgr.getRepository(SourceMaterial).findOne({
        where: { id: dto.sourceMaterialId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!material) throw new NotFoundException(`DATA-001: Không có nguồn vật chất ${dto.sourceMaterialId}`);
      assertRowVersion(material.rowVersion, dto.expectedSourceVersion);

      // available = mobilizable_qty của bản đánh giá huy động mới nhất.
      const mob = await mgr.getRepository(MobilizationAssessment).findOne({
        where: { sourceMaterialId: material.id },
        order: { createdAt: 'DESC' },
      });
      const available = mob ? Number(mob.mobilizableQty) : 0;

      // Σ giữ chỗ ACTIVE hiện tại của nguồn vật chất này (mọi dòng/kế hoạch).
      const activeRows = await mgr.getRepository(SourceReservation).find({
        where: { sourceMaterialId: material.id, status: ReservationStatus.ACTIVE },
      });
      const sumActive = round3(activeRows.reduce((s, r) => s + Number(r.reservedQty), 0));

      assertReservationWithinAvailable(sumActive, dto.reservedQty, available); // ném INSUFFICIENT_FREE_SOURCE

      const reservation = await mgr.getRepository(SourceReservation).save(
        mgr.getRepository(SourceReservation).create({
          balanceLineId,
          sourceMaterialId: material.id,
          reservedQty: String(dto.reservedQty),
          priority: dto.priority ?? 100,
          status: ReservationStatus.ACTIVE,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
      // Chạm source_material → bump row_version (optimistic guard cho giao dịch song song khác).
      material.updatedBy = this.uid(user);
      await mgr.getRepository(SourceMaterial).save(material);

      await this.recomputeLine(balanceLineId, mgr);
      return reservation;
    });
  }

  async release(reservationId: string, user: AuthUser): Promise<SourceReservation> {
    const res = await this.reservations.findOne({ where: { id: reservationId } });
    if (!res) throw new NotFoundException(`DATA-001: Không có giữ chỗ ${reservationId}`);
    res.status = ReservationStatus.RELEASED;
    res.updatedBy = this.uid(user);
    const saved = await this.reservations.save(res);
    await this.recomputeLine(res.balanceLineId, this.dataSource.manager);
    return saved;
  }

  // ======================= Execution → DT-05 (BR-DT09-028) =======================
  async createExecutionRequest(
    balanceLineId: string,
    dto: ExecutionRequestDto,
    user: AuthUser,
  ): Promise<ExecutionRequest> {
    const line = await this.lines.findOne({ where: { id: balanceLineId } });
    if (!line) throw new NotFoundException(`DATA-001: Không có dòng cân đối ${balanceLineId}`);
    const plan = await this.getPlanEntity(line.planId);
    this.assertPlanMutable(plan);

    let req = await this.execRequests.save(
      this.execRequests.create({
        balanceLineId,
        requestedQty: String(dto.requestedQty),
        targetOrg: dto.targetOrg ?? null,
        status: ExecutionStatus.DRAFT,
        deliveredQty: '0',
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );

    if (dto.spawnDocument) {
      if (!dto.organizationId) {
        throw new BusinessException(BusinessError.INVALID_LOCATION, 'Cần organizationId để lập chứng từ DT-05');
      }
      const doc = await this.documents.createDocument(
        {
          documentType: InventoryDocumentType.ISSUE,
          organizationId: dto.organizationId,
          effectiveDate: dto.effectiveDate ?? new Date().toISOString().slice(0, 10),
          basisDocumentId: req.id,
        },
        user,
      );
      req.dt05DocumentId = doc.id;
      req.status = ExecutionStatus.SENT;
      req = await this.execRequests.save(req);
    }
    return req;
  }

  async feedback(
    executionRequestId: string,
    dto: ExecutionFeedbackDto,
    user: AuthUser,
  ): Promise<ExecutionRequest> {
    const req = await this.execRequests.findOne({ where: { id: executionRequestId } });
    if (!req) throw new NotFoundException(`DATA-001: Không có yêu cầu thực thi ${executionRequestId}`);

    await this.feedbacks.save(
      this.feedbacks.create({
        executionRequestId,
        deliveredQty: String(dto.deliveredQty),
        feedbackNote: dto.feedbackNote ?? null,
        fedBackBy: this.uid(user),
        fedBackAt: new Date(),
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    req.deliveredQty = String(round3(Number(req.deliveredQty) + dto.deliveredQty));
    req.feedbackNote = dto.feedbackNote ?? req.feedbackNote;
    req.status = dto.status ?? ExecutionStatus.EXECUTED;
    req.updatedBy = this.uid(user);
    const saved = await this.execRequests.save(req);
    await this.recomputeLine(req.balanceLineId, this.dataSource.manager);
    return saved;
  }

  // ======================= Phê duyệt & khóa snapshot (BR-DT09-020) =======================
  async approve(id: string, user: AuthUser) {
    const plan = await this.getPlanEntity(id);
    assertTransition(BALANCE_PLAN_TRANSITIONS, plan.status, BalancePlanStatus.APPROVED);
    plan.status = BalancePlanStatus.APPROVED;
    plan.updatedBy = this.uid(user);
    await this.plans.save(plan);
    return this.getPlan(id);
  }

  async lock(id: string, user: AuthUser): Promise<BalanceSnapshot> {
    const plan = await this.getPlanEntity(id);
    assertTransition(BALANCE_PLAN_TRANSITIONS, plan.status, BalancePlanStatus.LOCKED);

    const lines = await this.lines.find({ where: { planId: id }, order: { createdAt: 'ASC' } });
    const fpEntries: FingerprintEntry[] = [];
    const snapLinesData: Array<{
      materialCatalogId: string;
      supplyRequired: number;
      plannedSourceQty: number;
      gapQty: number;
      reservations: Array<{ sourceMaterialId: string; reservedQty: number; priority: number }>;
    }> = [];

    for (const line of lines) {
      const active = await this.reservations.find({
        where: { balanceLineId: line.id, status: ReservationStatus.ACTIVE },
      });
      const resSummary = active.map((r) => ({
        sourceMaterialId: r.sourceMaterialId,
        reservedQty: Number(r.reservedQty),
        priority: r.priority,
      }));
      for (const r of active) {
        const [ver, mob] = await Promise.all([
          this.verifications.findOne({ where: { sourceMaterialId: r.sourceMaterialId }, order: { createdAt: 'DESC' } }),
          this.mobilizations.findOne({ where: { sourceMaterialId: r.sourceMaterialId }, order: { createdAt: 'DESC' } }),
        ]);
        fpEntries.push({
          sourceMaterialId: r.sourceMaterialId,
          verificationStatus: ver?.status ?? null,
          verifiedQty: ver?.verifiedQty != null ? Number(ver.verifiedQty) : null,
          mobilizableQty: mob ? Number(mob.mobilizableQty) : 0,
          reservedQty: Number(r.reservedQty),
        });
      }
      snapLinesData.push({
        materialCatalogId: line.materialCatalogId,
        supplyRequired: Number(line.supplyRequired),
        plannedSourceQty: Number(line.plannedSourceQty),
        gapQty: Number(line.gapQty),
        reservations: resSummary,
      });
    }

    const fingerprint = sourceFingerprint(fpEntries);
    const checksum = computeBalanceChecksum(
      plan.planCode,
      plan.revisionNo,
      snapLinesData.map((l) => ({
        materialCatalogId: l.materialCatalogId,
        supplyRequired: l.supplyRequired,
        plannedSourceQty: l.plannedSourceQty,
        gapQty: l.gapQty,
      })),
      fingerprint,
    );

    const snapshot = await this.snapshots.save(
      this.snapshots.create({
        planId: plan.id,
        planRevisionNo: plan.revisionNo,
        approvedAt: new Date(),
        checksum,
        sourceFingerprint: fingerprint,
        locked: true,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    await this.snapshotLines.save(
      snapLinesData.map((l) =>
        this.snapshotLines.create({
          snapshotId: snapshot.id,
          materialCatalogId: l.materialCatalogId,
          supplyRequired: String(l.supplyRequired),
          plannedSourceQty: String(l.plannedSourceQty),
          gapQty: String(l.gapQty),
          reservationsJson: l.reservations,
        }),
      ),
    );

    plan.status = BalancePlanStatus.LOCKED;
    plan.lockedAt = new Date();
    plan.lockedBy = this.uid(user);
    plan.checksum = checksum;
    plan.sourceFingerprint = fingerprint;
    plan.updatedBy = this.uid(user);
    await this.plans.save(plan);
    return snapshot;
  }

  // ======================= Tổng hợp gap =======================
  async gapSummary(id: string) {
    const plan = await this.getPlanEntity(id);
    const lines = await this.lines.find({ where: { planId: id }, order: { createdAt: 'ASC' } });
    const lineIds = lines.map((l) => l.id);
    const execs = lineIds.length
      ? await this.execRequests
          .createQueryBuilder('e')
          .where('e.balance_line_id IN (:...ids)', { ids: lineIds })
          .getMany()
      : [];
    const deliveredByLine = new Map<string, number>();
    for (const e of execs) {
      deliveredByLine.set(e.balanceLineId, (deliveredByLine.get(e.balanceLineId) ?? 0) + Number(e.deliveredQty));
    }

    let totalRequired = 0;
    let totalPlanned = 0;
    let totalGap = 0;
    let totalDelivered = 0;
    const rows = lines.map((l) => {
      const required = Number(l.supplyRequired);
      const planned = Number(l.plannedSourceQty);
      const gap = Number(l.gapQty);
      const delivered = round3(deliveredByLine.get(l.id) ?? 0);
      totalRequired = round3(totalRequired + required);
      totalPlanned = round3(totalPlanned + planned);
      totalGap = round3(totalGap + gap);
      totalDelivered = round3(totalDelivered + delivered);
      return {
        lineId: l.id,
        materialCatalogId: l.materialCatalogId,
        supplyRequired: required,
        plannedSourceQty: planned,
        gapQty: gap,
        deliveredQty: delivered,
        status: l.status,
      };
    });

    return {
      planId: plan.id,
      planCode: plan.planCode,
      status: plan.status,
      totals: { supplyRequired: totalRequired, plannedSourceQty: totalPlanned, gapQty: totalGap, deliveredQty: totalDelivered },
      lines: rows,
    };
  }

  private lineView(line: BalanceLine) {
    return {
      id: line.id,
      planId: line.planId,
      materialCatalogId: line.materialCatalogId,
      unitId: line.unitId,
      supplyRequired: Number(line.supplyRequired),
      plannedSourceQty: Number(line.plannedSourceQty),
      gapQty: Number(line.gapQty),
      status: line.status,
    };
  }
}
