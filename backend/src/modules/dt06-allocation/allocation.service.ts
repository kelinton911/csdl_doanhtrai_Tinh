import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllocationType } from './entities/allocation-type.entity';
import { InventoryAllocation } from './entities/inventory-allocation.entity';
import { AllocationLine } from './entities/allocation-line.entity';
import { AllocationHold } from './entities/allocation-hold.entity';
import { ReserveRequirementLink } from './entities/reserve-requirement-link.entity';
import { AllocationSnapshot, AllocationSnapshotLine } from './entities/allocation-snapshot.entity';
import { AllocationChangeRequest } from './entities/allocation-change-request.entity';
import { SlowMovingRule, SlowMovingEvaluation } from './entities/slow-moving.entity';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { MovementStatus } from '../dt04-materiel/materiel-rules';
import {
  ALLOCATION_TRANSITIONS,
  AllocationCategory,
  AllocationSemantics,
  AllocationStatus,
  HoldStatus,
  assertAllocationSnapshotUnlocked,
  assertExclusiveWithinAllocatable,
  hcAllocatable,
  reserveGap,
} from './alloc-rules';
import { assertTransition } from '../../common/enums/assert-transition';
import { resolveAsOf } from '../../common/time/as-of';
import { ActiveStatus } from '../catalog/catalog.enums';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  AddAllocationLineDto,
  CreateAllocationDto,
  CreateAllocationTypeDto,
  CreateChangeRequestDto,
  CreateHoldDto,
  CreateReserveLinkDto,
  CreateSlowRuleDto,
  CreateSnapshotDto,
} from './dt06.dto';

@Injectable()
export class AllocationService {
  constructor(
    @InjectRepository(AllocationType) private readonly types: Repository<AllocationType>,
    @InjectRepository(InventoryAllocation) private readonly allocations: Repository<InventoryAllocation>,
    @InjectRepository(AllocationLine) private readonly lines: Repository<AllocationLine>,
    @InjectRepository(AllocationHold) private readonly holds: Repository<AllocationHold>,
    @InjectRepository(ReserveRequirementLink) private readonly reserveLinks: Repository<ReserveRequirementLink>,
    @InjectRepository(AllocationSnapshot) private readonly snapshots: Repository<AllocationSnapshot>,
    @InjectRepository(AllocationSnapshotLine) private readonly snapshotLines: Repository<AllocationSnapshotLine>,
    @InjectRepository(AllocationChangeRequest) private readonly changeRequests: Repository<AllocationChangeRequest>,
    @InjectRepository(SlowMovingRule) private readonly slowRules: Repository<SlowMovingRule>,
    @InjectRepository(SlowMovingEvaluation) private readonly slowEvals: Repository<SlowMovingEvaluation>,
    @InjectRepository(MaterielMovement) private readonly movements: Repository<MaterielMovement>,
  ) {}

  private uid(u: AuthUser) {
    return u?.sub ?? null;
  }

  // HC (DT-04) của material tại đơn vị (Σ signed POSTED).
  private async hc(materialCatalogId: string, organizationId: string): Promise<number> {
    const row = await this.movements
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.quantity_signed),0)', 'hc')
      .where('m.material_catalog_id = :mat', { mat: materialCatalogId })
      .andWhere('m.organization_id = :org', { org: organizationId })
      .andWhere('m.status = :posted', { posted: MovementStatus.POSTED })
      .getRawOne<{ hc: string }>();
    return Number(row?.hc ?? 0);
  }

  private async exclusiveHeldQtys(materialCatalogId: string, organizationId: string): Promise<number[]> {
    const holds = await this.holds.find({
      where: {
        materialCatalogId,
        organizationId,
        status: HoldStatus.ACTIVE,
        semantics: AllocationSemantics.EXCLUSIVE,
      },
    });
    return holds.map((h) => Number(h.quantityReserved));
  }

  // ---- Allocation types ----
  async listTypes() {
    return this.types.find({ order: { code: 'ASC' } });
  }
  async createType(dto: CreateAllocationTypeDto, user: AuthUser): Promise<AllocationType> {
    const dup = await this.types.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Loại phân bổ ${dto.code} đã tồn tại`);
    return this.types.save(this.types.create({ ...dto, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  // ---- Allocations ----
  async createAllocation(dto: CreateAllocationDto, user: AuthUser): Promise<InventoryAllocation> {
    const type = await this.types.findOne({ where: { id: dto.allocationTypeId } });
    if (!type) throw new NotFoundException(`DATA-001: Không có loại phân bổ ${dto.allocationTypeId}`);
    return this.allocations.save(
      this.allocations.create({
        allocationNo: `ALLOC-${Date.now()}`,
        allocationTypeId: dto.allocationTypeId,
        organizationId: dto.organizationId,
        missionId: dto.missionId ?? null,
        effectiveFrom: dto.effectiveFrom ?? null,
        status: AllocationStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async getAllocation(id: string): Promise<InventoryAllocation> {
    const a = await this.allocations.findOne({ where: { id } });
    if (!a) throw new NotFoundException(`DATA-001: Không có phân bổ ${id}`);
    return a;
  }

  async addLine(allocationId: string, dto: AddAllocationLineDto, user: AuthUser): Promise<AllocationLine> {
    await this.getAllocation(allocationId);
    return this.lines.save(
      this.lines.create({
        allocationId,
        materialCatalogId: dto.materialCatalogId,
        lotId: dto.lotId ?? null,
        quantity: String(dto.quantity),
        priority: dto.priority ?? 100,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async transitionAllocation(id: string, to: AllocationStatus, user: AuthUser): Promise<InventoryAllocation> {
    const a = await this.getAllocation(id);
    assertTransition(ALLOCATION_TRANSITIONS, a.status, to);
    a.status = to;
    a.updatedBy = this.uid(user);
    return this.allocations.save(a);
  }

  // ---- Holds (BR-DT06-002: Σ exclusive ≤ HC_ALLOCATABLE) ----
  async createHold(allocationId: string, dto: CreateHoldDto, user: AuthUser): Promise<AllocationHold> {
    const alloc = await this.getAllocation(allocationId);
    const type = await this.types.findOne({ where: { id: alloc.allocationTypeId } });
    if (!type) throw new NotFoundException(`DATA-001: Không có loại phân bổ`);

    if (type.semantics === AllocationSemantics.EXCLUSIVE) {
      const hcVal = await this.hc(dto.materialCatalogId, alloc.organizationId);
      const allocatable = hcAllocatable(hcVal, 0);
      const existing = await this.exclusiveHeldQtys(dto.materialCatalogId, alloc.organizationId);
      assertExclusiveWithinAllocatable(existing, dto.quantityReserved, allocatable);
    }

    return this.holds.save(
      this.holds.create({
        allocationId,
        materialCatalogId: dto.materialCatalogId,
        lotId: dto.lotId ?? null,
        organizationId: alloc.organizationId,
        missionId: dto.missionId ?? alloc.missionId ?? null,
        quantityReserved: String(dto.quantityReserved),
        semantics: type.semantics,
        category: type.category,
        priority: dto.priority ?? type.priorityDefault,
        status: HoldStatus.ACTIVE,
        basisDocumentId: dto.basisDocumentId ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async releaseHold(id: string, user: AuthUser): Promise<AllocationHold> {
    const h = await this.holds.findOne({ where: { id } });
    if (!h) throw new NotFoundException(`DATA-001: Không có hold ${id}`);
    h.status = HoldStatus.RELEASED;
    h.updatedBy = this.uid(user);
    return this.holds.save(h);
  }

  // HC_ALLOCATABLE của material/org (GET /allocations/allocatable).
  async allocatable(materialCatalogId: string, organizationId: string) {
    const hcVal = await this.hc(materialCatalogId, organizationId);
    const exclusive = (await this.exclusiveHeldQtys(materialCatalogId, organizationId)).reduce((s, q) => s + q, 0);
    const allocatableVal = hcAllocatable(hcVal, 0);
    return {
      materialCatalogId,
      organizationId,
      hc: hcVal,
      hcAllocatable: allocatableVal,
      exclusiveHeld: exclusive,
      free: allocatableVal - exclusive,
    };
  }

  // PC_SSCĐ cho DT-08 (SEM-RESERVE-SSCD = Σ hold cấp SSCĐ đang hiệu lực).
  async reserveSscd(organizationId?: string) {
    const qb = this.holds
      .createQueryBuilder('h')
      .select('h.material_catalog_id', 'materialCatalogId')
      .addSelect('COALESCE(SUM(h.quantity_reserved),0)', 'reserved')
      .where('h.status = :active', { active: HoldStatus.ACTIVE })
      .andWhere('h.category = :sscd', { sscd: AllocationCategory.SSCD })
      .groupBy('h.material_catalog_id');
    if (organizationId) qb.andWhere('h.organization_id = :org', { org: organizationId });
    const rows = await qb.getRawMany<{ materialCatalogId: string; reserved: string }>();
    return {
      semantic: 'SEM-RESERVE-SSCD',
      organizationId: organizationId ?? null,
      items: rows.map((r) => ({ materialCatalogId: r.materialCatalogId, reservedQty: Number(r.reserved) })),
    };
  }

  // ---- Reserve requirement link (đối chiếu định mức DT-07) ----
  async createReserveLink(dto: CreateReserveLinkDto, user: AuthUser): Promise<ReserveRequirementLink> {
    const { gapQty, status } = reserveGap(dto.requiredQty, dto.allocatedQty);
    return this.reserveLinks.save(
      this.reserveLinks.create({
        allocationId: dto.allocationId,
        materialCatalogId: dto.materialCatalogId,
        normReference: dto.normReference ?? null,
        requiredQty: String(dto.requiredQty),
        allocatedQty: String(dto.allocatedQty),
        gapQty: String(gapQty),
        gapStatus: status,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async listReserveLinks(allocationId: string) {
    return this.reserveLinks.find({ where: { allocationId } });
  }

  // ---- Change request (chuyển loại phân bổ) ----
  async createChangeRequest(dto: CreateChangeRequestDto, user: AuthUser): Promise<AllocationChangeRequest> {
    const hold = await this.holds.findOne({ where: { id: dto.holdId } });
    if (!hold) throw new NotFoundException(`DATA-001: Không có hold ${dto.holdId}`);
    return this.changeRequests.save(
      this.changeRequests.create({
        requestCode: `ACR-${Date.now()}`,
        holdId: dto.holdId,
        toTypeId: dto.toTypeId,
        quantity: String(dto.quantity),
        reason: dto.reason ?? null,
        status: 'SUBMITTED',
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // Duyệt chuyển loại: đổi semantics/category của hold theo loại đích (giữ HC — chỉ đổi nhãn).
  async approveChangeRequest(id: string, user: AuthUser): Promise<AllocationChangeRequest> {
    const cr = await this.changeRequests.findOne({ where: { id } });
    if (!cr) throw new NotFoundException(`DATA-001: Không có yêu cầu ${id}`);
    const toType = await this.types.findOne({ where: { id: cr.toTypeId } });
    if (!toType) throw new NotFoundException(`DATA-001: Không có loại đích`);
    if (cr.holdId) {
      const hold = await this.holds.findOne({ where: { id: cr.holdId } });
      if (hold) {
        // Nếu chuyển sang EXCLUSIVE, kiểm tra không vượt khả dụng.
        if (toType.semantics === AllocationSemantics.EXCLUSIVE && hold.semantics !== AllocationSemantics.EXCLUSIVE) {
          const hcVal = await this.hc(hold.materialCatalogId, hold.organizationId);
          const existing = await this.exclusiveHeldQtys(hold.materialCatalogId, hold.organizationId);
          assertExclusiveWithinAllocatable(existing, Number(hold.quantityReserved), hcAllocatable(hcVal, 0));
        }
        hold.semantics = toType.semantics;
        hold.category = toType.category;
        hold.updatedBy = this.uid(user);
        await this.holds.save(hold);
      }
    }
    cr.status = 'APPROVED';
    cr.approvedBy = this.uid(user);
    cr.updatedBy = this.uid(user);
    return this.changeRequests.save(cr);
  }

  // ---- Snapshot phân bổ (cutoff, bất biến) ----
  async createSnapshot(dto: CreateSnapshotDto, user: AuthUser): Promise<AllocationSnapshot> {
    const dup = await this.snapshots.findOne({ where: { snapshotCode: dto.snapshotCode } });
    if (dup) throw new ConflictException(`DATA-003: Snapshot ${dto.snapshotCode} đã tồn tại`);
    const cutoff = resolveAsOf(dto.cutoffTime);
    const snap = await this.snapshots.save(
      this.snapshots.create({
        snapshotCode: dto.snapshotCode,
        cutoffTime: cutoff,
        scope: dto.organizationId ? { organizationId: dto.organizationId } : {},
        locked: false,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    const qb = this.holds
      .createQueryBuilder('h')
      .select('h.category', 'category')
      .addSelect('h.material_catalog_id', 'materialCatalogId')
      .addSelect('h.organization_id', 'organizationId')
      .addSelect('COALESCE(SUM(h.quantity_reserved),0)', 'reserved')
      .where('h.status = :active', { active: HoldStatus.ACTIVE })
      .groupBy('h.category').addGroupBy('h.material_catalog_id').addGroupBy('h.organization_id');
    if (dto.organizationId) qb.andWhere('h.organization_id = :org', { org: dto.organizationId });
    const rows = await qb.getRawMany<{ category: string; materialCatalogId: string; organizationId: string; reserved: string }>();
    for (const r of rows) {
      await this.snapshotLines.save(
        this.snapshotLines.create({
          snapshotId: snap.id,
          allocationTypeCode: r.category,
          materialCatalogId: r.materialCatalogId,
          organizationId: r.organizationId,
          reservedQty: String(r.reserved),
        }),
      );
    }
    return snap;
  }

  async lockSnapshot(id: string, user: AuthUser): Promise<AllocationSnapshot> {
    const snap = await this.snapshots.findOne({ where: { id } });
    if (!snap) throw new NotFoundException(`DATA-001: Không có snapshot ${id}`);
    assertAllocationSnapshotUnlocked(snap.locked);
    snap.locked = true;
    snap.lockedAt = new Date();
    snap.lockedBy = this.uid(user);
    snap.updatedBy = this.uid(user);
    return this.snapshots.save(snap);
  }

  async snapshotLinesOf(id: string) {
    return this.snapshotLines.find({ where: { snapshotId: id } });
  }

  // ---- Slow-moving (overlay có version) ----
  async createSlowRule(dto: CreateSlowRuleDto, user: AuthUser): Promise<SlowMovingRule> {
    return this.slowRules.save(this.slowRules.create({ ...dto, status: ActiveStatus.ACTIVE, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  // Đánh giá chậm luân chuyển: vật chất không có giao dịch POSTED trong N ngày → overlay.
  async evaluateSlowMoving(ruleId: string, organizationId?: string) {
    const rule = await this.slowRules.findOne({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException(`DATA-001: Không có quy tắc ${ruleId}`);
    const days = Number((rule.criteriaJson as { noMovementDays?: number }).noMovementDays ?? 180);
    const cutoff = new Date(Date.now() - days * 86400000);
    const qb = this.movements
      .createQueryBuilder('m')
      .select('m.material_catalog_id', 'materialCatalogId')
      .addSelect('MAX(m.effective_time)', 'lastMove')
      .addSelect('COALESCE(SUM(m.quantity_signed),0)', 'hc')
      .where('m.status = :posted', { posted: MovementStatus.POSTED })
      .groupBy('m.material_catalog_id');
    if (organizationId) qb.andWhere('m.organization_id = :org', { org: organizationId });
    const rows = await qb.getRawMany<{ materialCatalogId: string; lastMove: string; hc: string }>();
    const slow = rows.filter((r) => Number(r.hc) > 0 && new Date(r.lastMove) < cutoff);
    const evals: SlowMovingEvaluation[] = [];
    for (const r of slow) {
      evals.push(
        await this.slowEvals.save(
          this.slowEvals.create({ ruleId, materialCatalogId: r.materialCatalogId, organizationId: organizationId ?? null, resultQty: String(r.hc) }),
        ),
      );
    }
    return { ruleId, ruleVersion: rule.ruleVersion, thresholdDays: days, overlayCount: evals.length, evaluations: evals };
  }
}
