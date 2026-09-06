import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryLot } from './entities/inventory-lot.entity';
import { AssetInstance } from './entities/asset-instance.entity';
import { MaterielMovement } from './entities/materiel-movement.entity';
import { MaterielSnapshot } from './entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from './entities/materiel-snapshot-line.entity';
import { QualityAssessment } from './entities/quality-assessment.entity';
import { InventoryAdjustmentRequest } from './entities/inventory-adjustment-request.entity';
import { AdjustmentStatus } from './dt04.enums';
import {
  MOVEMENT_TRANSITIONS,
  MovementStatus,
  MovementType,
  assertQualityWithinHc,
  assertSnapshotUnlocked,
  assertSufficientStock,
  signedQuantity,
} from './materiel-rules';
import { assertTransition } from '../../common/enums/assert-transition';
import { asOfResponse } from '../../common/dto/as-of-response';
import { resolveAsOf } from '../../common/time/as-of';
import { OutboxService } from '../../common/outbox/outbox.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { buildScopeContext } from '../../common/scope/scope-context';
import {
  CreateAdjustmentDto,
  CreateAssetDto,
  CreateLotDto,
  CreateMovementDto,
  CreateQualityDto,
  CreateSnapshotDto,
} from './dt04.dto';

@Injectable()
export class MaterielService {
  constructor(
    @InjectRepository(InventoryLot) private readonly lots: Repository<InventoryLot>,
    @InjectRepository(AssetInstance) private readonly assets: Repository<AssetInstance>,
    @InjectRepository(MaterielMovement) private readonly movements: Repository<MaterielMovement>,
    @InjectRepository(MaterielSnapshot) private readonly snapshots: Repository<MaterielSnapshot>,
    @InjectRepository(MaterielSnapshotLine) private readonly snapshotLines: Repository<MaterielSnapshotLine>,
    @InjectRepository(QualityAssessment) private readonly qualities: Repository<QualityAssessment>,
    @InjectRepository(InventoryAdjustmentRequest) private readonly adjustments: Repository<InventoryAdjustmentRequest>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  private uid(user: AuthUser) {
    return user?.sub ?? null;
  }

  // ---- HC(t) as-of-time (Σ signed POSTED, effective_time ≤ as_of) — BR-DT04-013/020 ----
  private async computeHc(filter: { materialCatalogId: string; organizationId?: string; lotId?: string }, asOf: Date): Promise<number> {
    const qb = this.movements
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.quantity_signed), 0)', 'hc')
      .where('m.material_catalog_id = :mat', { mat: filter.materialCatalogId })
      .andWhere('m.status = :posted', { posted: MovementStatus.POSTED })
      .andWhere('m.effective_time <= :asOf', { asOf });
    if (filter.organizationId) qb.andWhere('m.organization_id = :org', { org: filter.organizationId });
    if (filter.lotId) qb.andWhere('m.lot_id = :lot', { lot: filter.lotId });
    const row = await qb.getRawOne<{ hc: string }>();
    return Number(row?.hc ?? 0);
  }

  // API HC cho DT-08: kèm as_of_time/scope/source/locked (BR-DT04-020).
  async hcAsOf(materialCatalogId: string, asOfInput: string | undefined, user: AuthUser, organizationId?: string) {
    const asOf = resolveAsOf(asOfInput);
    const scope = buildScopeContext(user);
    const org = organizationId ?? (scope.provinceWide ? undefined : scope.organizationId ?? undefined);
    const hc = await this.computeHc({ materialCatalogId, organizationId: org }, asOf);
    return asOfResponse({ materialCatalogId, hc }, { asOf, source: 'ledger', locked: false, scope });
  }

  // ---- Lots & assets ----
  async createLot(dto: CreateLotDto, user: AuthUser): Promise<InventoryLot> {
    const dup = await this.lots.findOne({ where: { lotCode: dto.lotCode } });
    if (dup) throw new ConflictException(`DATA-003: Mã lô ${dto.lotCode} đã tồn tại`);
    return this.lots.save(this.lots.create({ ...dto, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  async getLot(id: string): Promise<InventoryLot> {
    const lot = await this.lots.findOne({ where: { id } });
    if (!lot) throw new NotFoundException(`DATA-001: Không có lô ${id}`);
    return lot;
  }

  async createAsset(dto: CreateAssetDto, user: AuthUser): Promise<AssetInstance> {
    const dup = await this.assets.findOne({ where: { assetCode: dto.assetCode } });
    if (dup) throw new ConflictException(`DATA-003: Mã tài sản ${dto.assetCode} đã tồn tại (BR-DT04-016)`);
    return this.assets.save(this.assets.create({ ...dto, createdBy: this.uid(user), updatedBy: this.uid(user) }));
  }

  async getAsset(id: string): Promise<AssetInstance> {
    const a = await this.assets.findOne({ where: { id } });
    if (!a) throw new NotFoundException(`DATA-001: Không có tài sản ${id}`);
    return a;
  }

  async getAssetByQr(qrValue: string): Promise<AssetInstance> {
    const a = await this.assets.findOne({ where: { qrValue } });
    if (!a) throw new NotFoundException(`DATA-001: Không có tài sản theo QR ${qrValue}`);
    return a;
  }

  // ---- Movements (state machine, chỉ POSTED tác động HC) ----
  async createMovement(dto: CreateMovementDto, user: AuthUser): Promise<MaterielMovement> {
    const signed = signedQuantity(dto.transactionType, dto.quantity);
    return this.movements.save(
      this.movements.create({
        transactionNo: `MV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionType: dto.transactionType,
        materialCatalogId: dto.materialCatalogId,
        lotId: dto.lotId ?? null,
        assetId: dto.assetId ?? null,
        quantity: String(Math.abs(dto.quantity)),
        quantitySigned: String(signed),
        organizationId: dto.organizationId,
        fromLocationId: dto.fromLocationId ?? null,
        toLocationId: dto.toLocationId ?? null,
        documentId: dto.documentId ?? null,
        effectiveTime: dto.effectiveTime ? new Date(dto.effectiveTime) : new Date(),
        reasonCode: dto.reasonCode ?? null,
        status: MovementStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  private async getMovement(id: string): Promise<MaterielMovement> {
    const m = await this.movements.findOne({ where: { id } });
    if (!m) throw new NotFoundException(`DATA-001: Không có giao dịch ${id}`);
    return m;
  }

  async transitionMovement(id: string, to: MovementStatus, user: AuthUser): Promise<MaterielMovement> {
    const m = await this.getMovement(id);
    assertTransition(MOVEMENT_TRANSITIONS, m.status, to);
    m.status = to;
    m.updatedBy = this.uid(user);
    return this.movements.save(m);
  }

  // Post: APPROVED→POSTED; kiểm tra không âm với phần giảm; ghi outbox (cùng transaction).
  async postMovement(id: string, user: AuthUser): Promise<MaterielMovement> {
    return this.dataSource.transaction(async (mgr) => {
      const repo = mgr.getRepository(MaterielMovement);
      const m = await repo.findOne({ where: { id } });
      if (!m) throw new NotFoundException(`DATA-001: Không có giao dịch ${id}`);
      assertTransition(MOVEMENT_TRANSITIONS, m.status, MovementStatus.POSTED);
      const signed = Number(m.quantitySigned);
      if (signed < 0) {
        const hcBefore = await this.computeHc(
          { materialCatalogId: m.materialCatalogId, organizationId: m.organizationId, lotId: m.lotId ?? undefined },
          new Date(),
        );
        assertSufficientStock(hcBefore, signed);
      }
      m.status = MovementStatus.POSTED;
      m.postedAt = new Date();
      m.updatedBy = this.uid(user);
      const saved = await repo.save(m);
      await this.outbox.enqueue(mgr, {
        aggregateType: 'materiel_movement',
        aggregateId: saved.id,
        eventType: 'materiel.movement.posted',
        payload: { materialCatalogId: saved.materialCatalogId, signed, organizationId: saved.organizationId },
      });
      return saved;
    });
  }

  // Reverse: giao dịch POSTED → sinh giao dịch đảo POSTED, đánh dấu gốc REVERSED (BR-DT04-004).
  async reverseMovement(id: string, user: AuthUser): Promise<MaterielMovement> {
    return this.dataSource.transaction(async (mgr) => {
      const repo = mgr.getRepository(MaterielMovement);
      const orig = await repo.findOne({ where: { id } });
      if (!orig) throw new NotFoundException(`DATA-001: Không có giao dịch ${id}`);
      assertTransition(MOVEMENT_TRANSITIONS, orig.status, MovementStatus.REVERSED);
      const reversal = repo.create({
        transactionNo: `RV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionType: orig.transactionType,
        materialCatalogId: orig.materialCatalogId,
        lotId: orig.lotId,
        assetId: orig.assetId,
        quantity: orig.quantity,
        quantitySigned: String(-Number(orig.quantitySigned)),
        organizationId: orig.organizationId,
        effectiveTime: new Date(),
        postedAt: new Date(),
        status: MovementStatus.POSTED,
        reversalOfId: orig.id,
        reasonCode: 'REVERSAL',
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      });
      const savedReversal = await repo.save(reversal);
      orig.status = MovementStatus.REVERSED;
      orig.updatedBy = this.uid(user);
      await repo.save(orig);
      return savedReversal;
    });
  }

  async listMovements(materialCatalogId?: string, organizationId?: string) {
    const qb = this.movements.createQueryBuilder('m').orderBy('m.effective_time', 'DESC').take(200);
    if (materialCatalogId) qb.andWhere('m.material_catalog_id = :mat', { mat: materialCatalogId });
    if (organizationId) qb.andWhere('m.organization_id = :org', { org: organizationId });
    return qb.getMany();
  }

  // ---- Quality (Σ cấp ≤ HC lô) ----
  async createQuality(dto: CreateQualityDto, user: AuthUser): Promise<QualityAssessment> {
    await this.getLot(dto.lotId);
    const hcLot = await this.computeHc({ materialCatalogId: (await this.getLot(dto.lotId)).materialCatalogId, lotId: dto.lotId }, new Date());
    const existing = await this.qualities.find({ where: { lotId: dto.lotId, status: 'ACTIVE' } });
    const gradeQtys = existing.map((q) => Number(q.quantity)).concat(dto.quantity);
    assertQualityWithinHc(gradeQtys, hcLot);
    return this.qualities.save(
      this.qualities.create({
        lotId: dto.lotId,
        grade: dto.grade,
        quantity: String(dto.quantity),
        assessmentTime: dto.assessmentTime ? new Date(dto.assessmentTime) : new Date(),
        basisDocumentId: dto.basisDocumentId ?? null,
        assessor: this.uid(user),
        status: 'ACTIVE',
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async qualityHistory(lotId: string) {
    return this.qualities.find({ where: { lotId }, order: { assessmentTime: 'DESC' } });
  }

  // ---- Snapshots (lock bất biến) ----
  async createSnapshot(dto: CreateSnapshotDto, user: AuthUser): Promise<MaterielSnapshot> {
    const dup = await this.snapshots.findOne({ where: { snapshotCode: dto.snapshotCode } });
    if (dup) throw new ConflictException(`DATA-003: Snapshot ${dto.snapshotCode} đã tồn tại`);
    const asOf = resolveAsOf(dto.asOfTime);
    const snap = await this.snapshots.save(
      this.snapshots.create({
        snapshotCode: dto.snapshotCode,
        asOfTime: asOf,
        scope: dto.organizationId ? { organizationId: dto.organizationId } : {},
        locked: false,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    // Dựng dòng snapshot từ sổ cái tại as_of (theo material + lô).
    const rows = await this.movements
      .createQueryBuilder('m')
      .select('m.material_catalog_id', 'materialCatalogId')
      .addSelect('m.lot_id', 'lotId')
      .addSelect('m.organization_id', 'organizationId')
      .addSelect('COALESCE(SUM(m.quantity_signed),0)', 'qty')
      .where('m.status = :posted', { posted: MovementStatus.POSTED })
      .andWhere('m.effective_time <= :asOf', { asOf })
      .andWhere(dto.organizationId ? 'm.organization_id = :org' : '1=1', dto.organizationId ? { org: dto.organizationId } : {})
      .groupBy('m.material_catalog_id')
      .addGroupBy('m.lot_id')
      .addGroupBy('m.organization_id')
      .getRawMany<{ materialCatalogId: string; lotId: string | null; organizationId: string; qty: string }>();
    for (const r of rows) {
      if (Number(r.qty) === 0) continue;
      await this.snapshotLines.save(
        this.snapshotLines.create({
          snapshotId: snap.id,
          materialCatalogId: r.materialCatalogId,
          lotId: r.lotId,
          organizationId: r.organizationId,
          quantityOnHand: String(r.qty),
        }),
      );
    }
    return snap;
  }

  async lockSnapshot(id: string, user: AuthUser): Promise<MaterielSnapshot> {
    const snap = await this.snapshots.findOne({ where: { id } });
    if (!snap) throw new NotFoundException(`DATA-001: Không có snapshot ${id}`);
    assertSnapshotUnlocked(snap.locked); // đã khóa → LOCKED_IMMUTABLE.
    snap.locked = true;
    snap.lockedAt = new Date();
    snap.lockedBy = this.uid(user);
    snap.updatedBy = this.uid(user);
    return this.snapshots.save(snap);
  }

  async getSnapshotLines(id: string) {
    return this.snapshotLines.find({ where: { snapshotId: id } });
  }

  // ---- Adjustment workflow (duyệt → sinh ADJUSTMENT movement) ----
  async createAdjustment(dto: CreateAdjustmentDto, user: AuthUser): Promise<InventoryAdjustmentRequest> {
    const before = await this.computeHc({ materialCatalogId: dto.materialCatalogId, organizationId: dto.organizationId, lotId: dto.lotId }, new Date());
    const delta = dto.proposedQty - before;
    return this.adjustments.save(
      this.adjustments.create({
        requestCode: `ADJ-${Date.now()}`,
        materialCatalogId: dto.materialCatalogId,
        lotId: dto.lotId ?? null,
        organizationId: dto.organizationId,
        locationId: dto.locationId ?? null,
        beforeQty: String(before),
        proposedQty: String(dto.proposedQty),
        deltaQty: String(delta),
        reasonCode: dto.reasonCode,
        status: AdjustmentStatus.DRAFT,
        requestedBy: this.uid(user),
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // Duyệt điều chỉnh: sinh giao dịch ADJUSTMENT POSTED với delta (SYS-BR-02: không sửa số dư trực tiếp).
  async approveAdjustment(id: string, user: AuthUser): Promise<InventoryAdjustmentRequest> {
    return this.dataSource.transaction(async (mgr) => {
      const adjRepo = mgr.getRepository(InventoryAdjustmentRequest);
      const moveRepo = mgr.getRepository(MaterielMovement);
      const adj = await adjRepo.findOne({ where: { id } });
      if (!adj) throw new NotFoundException(`DATA-001: Không có yêu cầu điều chỉnh ${id}`);
      if (adj.status === AdjustmentStatus.POSTED) {
        throw new ConflictException('DATA-003: Yêu cầu đã được duyệt/ghi sổ');
      }
      const delta = Number(adj.deltaQty);
      const movement = moveRepo.create({
        transactionNo: `MV-ADJ-${Date.now()}`,
        transactionType: MovementType.ADJUSTMENT,
        materialCatalogId: adj.materialCatalogId,
        lotId: adj.lotId,
        quantity: String(Math.abs(delta)),
        quantitySigned: String(delta),
        organizationId: adj.organizationId,
        effectiveTime: new Date(),
        postedAt: new Date(),
        status: MovementStatus.POSTED,
        reasonCode: adj.reasonCode,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      });
      const savedMove = await moveRepo.save(movement);
      adj.status = AdjustmentStatus.POSTED;
      adj.approvedBy = this.uid(user);
      adj.movementId = savedMove.id;
      adj.updatedBy = this.uid(user);
      return adjRepo.save(adj);
    });
  }

  // ---- Reconciliation (ledger vs snapshot line) ----
  async reconciliation(snapshotId: string) {
    const lines = await this.snapshotLines.find({ where: { snapshotId } });
    const snap = await this.snapshots.findOne({ where: { id: snapshotId } });
    if (!snap) throw new NotFoundException(`DATA-001: Không có snapshot ${snapshotId}`);
    const diffs: Array<{ materialCatalogId: string; snapshotQty: number; ledgerQty: number; difference: number }> = [];
    for (const line of lines) {
      const ledger = await this.computeHc(
        { materialCatalogId: line.materialCatalogId, organizationId: line.organizationId ?? undefined, lotId: line.lotId ?? undefined },
        snap.asOfTime,
      );
      const snapQty = Number(line.quantityOnHand);
      if (Math.abs(ledger - snapQty) > 1e-6) {
        diffs.push({ materialCatalogId: line.materialCatalogId, snapshotQty: snapQty, ledgerQty: ledger, difference: ledger - snapQty });
      }
    }
    return { snapshotId, reconciled: diffs.length === 0, differenceCount: diffs.length, differences: diffs };
  }
}
