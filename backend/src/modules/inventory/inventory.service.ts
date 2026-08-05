import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StorageLocation } from './entities/storage-location.entity';
import { StorageLocationRevision } from './entities/storage-location-revision.entity';
import { InventoryTransaction, TxType } from './entities/inventory-transaction.entity';
import { StockBalance } from './entities/stock-balance.entity';
import {
  AdjustmentDto,
  CreateStorageLocationDto,
  CreateTransactionDto,
  ListStorageLocationsQuery,
  StorageReviewDto,
  UpdateStorageLocationDto,
} from './dto/inventory.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
  transitionWithRevision,
} from '../../common/workflow-transition';

// M06 — Inventory. UC-08: tồn kho và vị trí lưu giữ. Sổ kho bất biến; điều chỉnh bằng
// bút toán mới; không cho tồn âm nếu không có quyền ngoại lệ. Kho có workflow duyệt.
@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StorageLocation)
    private readonly locations: Repository<StorageLocation>,
    @InjectRepository(StorageLocationRevision)
    private readonly locationRevisions: Repository<StorageLocationRevision>,
    @InjectRepository(InventoryTransaction)
    private readonly txns: Repository<InventoryTransaction>,
    @InjectRepository(StockBalance)
    private readonly balances: Repository<StockBalance>,
    private readonly dataSource: DataSource,
  ) {}

  // ------- Kho -------
  // Danh sách kho kèm tên xã + trạng thái workflow, lọc theo phạm vi dữ liệu (server-side).
  async listLocations(q: ListStorageLocationsQuery, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.locations
      .createQueryBuilder('l')
      .leftJoin('administrative_areas', 'a', 'a.id = l.area_id')
      .leftJoin('barracks', 'b', 'b.id = l.barracks_id')
      .select('l.id', 'id')
      .addSelect('l.code', 'code')
      .addSelect('l.name', 'name')
      .addSelect('l.type', 'type')
      .addSelect('l.nganh', 'nganh')
      .addSelect('l.cap', 'cap')
      .addSelect('l.capacity_tons', 'capacityTons')
      .addSelect('l.barracks_id', 'barracksId')
      .addSelect('l.area_id', 'areaId')
      .addSelect('l.workflow_status', 'workflowStatus')
      .addSelect('l.status', 'status')
      .addSelect('l.updated_at', 'updatedAt')
      .addSelect('a.name', 'areaName')
      .addSelect('b.name', 'barracksName')
      .orderBy('l.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);
    const countQb = this.locations.createQueryBuilder('l');

    if (q.search) {
      qb.andWhere('(l.code ILIKE :s OR l.name ILIKE :s)', { s: `%${q.search}%` });
      countQb.andWhere('(l.code ILIKE :s OR l.name ILIKE :s)', { s: `%${q.search}%` });
    }
    if (q.status) {
      qb.andWhere('l.workflow_status = :st', { st: q.status });
      countQb.andWhere('l.workflow_status = :st', { st: q.status });
    }
    if (scope) {
      const cond = '(l.area_id = ANY(:areaIds::uuid[]) OR l.organization_id = :orgId)';
      const params = { areaIds: scope.areaIds, orgId: scope.organizationId };
      qb.andWhere(cond, params);
      countQb.andWhere(cond, params);
    }

    const data = await qb.getRawMany();
    const total = await countQb.getCount();
    return paginated(data, total, q);
  }

  async getLocation(id: string): Promise<StorageLocation> {
    const found = await this.locations.findOne({ where: { id } });
    if (!found) throw new NotFoundException('DATA-001: Không tìm thấy kho');
    return found;
  }

  async createLocation(dto: CreateStorageLocationDto, user: AuthUser) {
    const dup = await this.locations.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã kho ${dto.code}`);
    return this.locations.save(
      this.locations.create({
        code: dto.code,
        name: dto.name,
        type: dto.type ?? null,
        nganh: dto.nganh ?? null,
        cap: dto.cap ?? null,
        capacityTons: dto.capacityTons != null ? String(dto.capacityTons) : null,
        barracksId: dto.barracksId ?? null,
        areaId: dto.areaId ?? null,
        organizationId: dto.organizationId ?? user.organizationId ?? null,
        status: 'ACTIVE',
        workflowStatus: WorkflowStatus.DRAFT,
        createdBy: user.sub,
        updatedBy: user.sub,
      }),
    );
  }

  async updateLocation(id: string, dto: UpdateStorageLocationDto, user: AuthUser) {
    const l = await this.getLocation(id);
    assertEditable(l.workflowStatus);
    if (dto.name !== undefined) l.name = dto.name;
    if (dto.type !== undefined) l.type = dto.type;
    if (dto.nganh !== undefined) l.nganh = dto.nganh;
    if (dto.cap !== undefined) l.cap = dto.cap;
    if (dto.capacityTons !== undefined)
      l.capacityTons = dto.capacityTons != null ? String(dto.capacityTons) : null;
    if (dto.barracksId !== undefined) l.barracksId = dto.barracksId;
    if (dto.areaId !== undefined) l.areaId = dto.areaId;
    if (dto.organizationId !== undefined) l.organizationId = dto.organizationId;
    l.updatedBy = user.sub;
    return this.locations.save(l);
  }

  // Xã gửi duyệt hồ sơ kho — DRAFT/CHANGES_REQUESTED → PENDING_REVIEW.
  async submitLocation(id: string, user: AuthUser) {
    const l = await this.getLocation(id);
    assertEditable(l.workflowStatus, 'gửi duyệt');
    return this.transitionLocation(l, WorkflowStatus.PENDING_REVIEW, user);
  }

  // Chỉ huy xã duyệt — PENDING_REVIEW → APPROVED (người lập không tự duyệt).
  async approveLocation(id: string, user: AuthUser) {
    const l = await this.getLocation(id);
    assertPendingReview(l.workflowStatus);
    assertNotSelfApprove(l.createdBy, user.sub);
    return this.transitionLocation(l, WorkflowStatus.APPROVED, user);
  }

  async requestLocationChanges(id: string, _dto: StorageReviewDto, user: AuthUser) {
    const l = await this.getLocation(id);
    assertPendingReview(l.workflowStatus, 'yêu cầu bổ sung');
    return this.transitionLocation(l, WorkflowStatus.CHANGES_REQUESTED, user);
  }

  async listLocationRevisions(id: string) {
    await this.getLocation(id);
    return this.locationRevisions.find({
      where: { storageLocationId: id },
      order: { revisionNo: 'DESC' },
    });
  }

  private async transitionLocation(l: StorageLocation, to: WorkflowStatus, user: AuthUser) {
    return transitionWithRevision(
      {
        dataSource: this.dataSource,
        entityTarget: StorageLocation,
        revisionTarget: StorageLocationRevision,
        fkColumn: 'storageLocationId',
        buildPayload: (saved) => ({
          code: saved.code,
          name: saved.name,
          type: saved.type,
          nganh: saved.nganh,
          cap: saved.cap,
          capacityTons: saved.capacityTons,
          barracksId: saved.barracksId,
          areaId: saved.areaId,
          organizationId: saved.organizationId,
        }),
      },
      l,
      to,
      user.sub,
    );
  }

  // ------- Số dư tồn -------
  // Lọc theo phạm vi dữ liệu (server-side): người dùng cấp xã chỉ thấy tồn của địa bàn mình;
  // vai trò toàn tỉnh thấy tất cả. Hỗ trợ lọc theo 1 xã (areaId) cho màn "Vật chất chung của xã".
  async listBalances(
    q: PaginationQuery,
    filters: { storageLocationId?: string; materialId?: string; areaId?: string },
    user?: AuthUser,
  ) {
    const scope = barracksScope(user);
    const qb = this.dataSource
      .createQueryBuilder()
      .select('sb.id', 'id')
      .addSelect('sb.material_id', 'materialId')
      .addSelect('sb.storage_location_id', 'storageLocationId')
      .addSelect('sb.on_hand', 'onHand')
      .addSelect('sb.last_counted', 'lastCounted')
      .addSelect('sb.updated_at', 'updatedAt')
      .addSelect('m.code', 'materialCode')
      .addSelect('m.name', 'materialName')
      .addSelect('m.unit_code', 'unitCode')
      .addSelect('m.category_code', 'categoryCode')
      .addSelect('l.code', 'locationCode')
      .addSelect('l.name', 'locationName')
      .addSelect('l.area_id', 'areaId')
      .addSelect('a.name', 'areaName')
      .from(StockBalance, 'sb')
      .leftJoin('materials', 'm', 'm.id = sb.material_id')
      .leftJoin('storage_locations', 'l', 'l.id = sb.storage_location_id')
      .leftJoin('administrative_areas', 'a', 'a.id = l.area_id')
      .orderBy('m.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);
    // Query đếm dùng cùng join kho để áp được điều kiện phạm vi/địa bàn.
    const countQb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'cnt')
      .from(StockBalance, 'sb')
      .leftJoin('storage_locations', 'l', 'l.id = sb.storage_location_id');

    for (const b of [qb, countQb]) {
      if (filters.storageLocationId)
        b.andWhere('sb.storage_location_id = :loc', { loc: filters.storageLocationId });
      if (filters.materialId) b.andWhere('sb.material_id = :mat', { mat: filters.materialId });
      if (filters.areaId) b.andWhere('l.area_id = :area', { area: filters.areaId });
      if (scope)
        b.andWhere('(l.area_id = ANY(:areaIds::uuid[]) OR l.organization_id = :orgId)', {
          areaIds: scope.areaIds,
          orgId: scope.organizationId,
        });
    }

    const rows = await qb.getRawMany();
    const countRow = await countQb.getRawOne<{ cnt: string }>();
    const total = Number(countRow?.cnt ?? 0);

    const data = rows.map((r) => ({
      ...r,
      onHand: Number(r.onHand),
      lastCounted: r.lastCounted !== null ? Number(r.lastCounted) : null,
      variance: r.lastCounted !== null ? Number(r.lastCounted) - Number(r.onHand) : null,
    }));
    return paginated(data, total, q);
  }

  // Tổng hợp tồn theo xã × nhóm ngành — "vật chất chung của xã" (Khâu 1). Bỏ trống areaId
  // = tổng toàn tỉnh (theo phạm vi dữ liệu của người dùng). Đọc từ tồn thực đã ghi sổ.
  async summaryByArea(filters: { areaId?: string; categoryCode?: string }, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.dataSource
      .createQueryBuilder()
      .select('a.id', 'areaId')
      .addSelect('a.name', 'areaName')
      .addSelect('m.category_code', 'categoryCode')
      .addSelect('cat.name', 'categoryName')
      .addSelect('COUNT(DISTINCT sb.material_id)', 'materialKinds')
      .addSelect('COALESCE(SUM(sb.on_hand), 0)', 'totalOnHand')
      .from(StockBalance, 'sb')
      .leftJoin('storage_locations', 'l', 'l.id = sb.storage_location_id')
      .leftJoin('administrative_areas', 'a', 'a.id = l.area_id')
      .leftJoin('materials', 'm', 'm.id = sb.material_id')
      .leftJoin('catalogs', 'cat', "cat.type = 'material-category' AND cat.code = m.category_code")
      .groupBy('a.id')
      .addGroupBy('a.name')
      .addGroupBy('m.category_code')
      .addGroupBy('cat.name')
      .orderBy('a.name', 'ASC')
      .addOrderBy('cat.name', 'ASC');
    if (filters.areaId) qb.andWhere('l.area_id = :area', { area: filters.areaId });
    if (filters.categoryCode) qb.andWhere('m.category_code = :cc', { cc: filters.categoryCode });
    if (scope)
      qb.andWhere('(l.area_id = ANY(:areaIds::uuid[]) OR l.organization_id = :orgId)', {
        areaIds: scope.areaIds,
        orgId: scope.organizationId,
      });
    const rows = await qb.getRawMany<{
      areaId: string | null;
      areaName: string | null;
      categoryCode: string | null;
      categoryName: string | null;
      materialKinds: string;
      totalOnHand: string;
    }>();
    return rows.map((r) => ({
      areaId: r.areaId,
      areaName: r.areaName,
      categoryCode: r.categoryCode,
      categoryName: r.categoryName,
      materialKinds: Number(r.materialKinds),
      totalOnHand: Number(r.totalOnHand),
    }));
  }

  async listTransactions(
    q: PaginationQuery,
    filters: { storageLocationId?: string; materialId?: string },
  ) {
    const where: Record<string, string> = {};
    if (filters.storageLocationId) where.storageLocationId = filters.storageLocationId;
    if (filters.materialId) where.materialId = filters.materialId;
    const [data, total] = await this.txns.findAndCount({
      where,
      order: { occurredAt: 'DESC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  // ------- Bút toán nhập/xuất -------
  async transaction(dto: CreateTransactionDto, user: AuthUser) {
    return this.applyDelta(
      dto.type,
      dto.materialId,
      dto.storageLocationId,
      dto.type === 'IN' ? dto.quantity : -dto.quantity,
      { allowNegative: dto.allowNegative, documentRef: dto.documentRef, note: dto.note },
      user,
    );
  }

  // ------- Điều chỉnh kiểm kê (chênh lệch) -------
  async adjustment(dto: AdjustmentDto, user: AuthUser) {
    return this.dataSource.transaction(async (m) => {
      const bal = await this.lockBalance(m, dto.materialId, dto.storageLocationId);
      const current = Number(bal.onHand);
      const delta = dto.countedQuantity - current;
      bal.onHand = dto.countedQuantity.toFixed(3);
      bal.lastCounted = dto.countedQuantity.toFixed(3);
      const saved = await m.getRepository(StockBalance).save(bal);
      const txn = await m.getRepository(InventoryTransaction).save(
        m.getRepository(InventoryTransaction).create({
          materialId: dto.materialId,
          storageLocationId: dto.storageLocationId,
          type: 'ADJUST' as TxType,
          quantity: delta.toFixed(3),
          balanceAfter: saved.onHand,
          note: dto.note ?? `Điều chỉnh kiểm kê (chênh lệch ${delta.toFixed(3)})`,
          createdBy: user.sub,
        }),
      );
      return { transaction: txn, balance: saved };
    });
  }

  private async applyDelta(
    type: TxType,
    materialId: string,
    storageLocationId: string,
    delta: number,
    opts: { allowNegative?: boolean; documentRef?: string; note?: string },
    user: AuthUser,
  ) {
    return this.dataSource.transaction(async (m) => {
      const bal = await this.lockBalance(m, materialId, storageLocationId);
      const next = Number(bal.onHand) + delta;
      if (next < 0 && !opts.allowNegative) {
        throw new ConflictException(
          `INV-001: Xuất vượt tồn (còn ${bal.onHand}); cần quyền ngoại lệ để tồn âm`,
        );
      }
      bal.onHand = next.toFixed(3);
      const saved = await m.getRepository(StockBalance).save(bal);
      const txn = await m.getRepository(InventoryTransaction).save(
        m.getRepository(InventoryTransaction).create({
          materialId,
          storageLocationId,
          type,
          quantity: Math.abs(delta).toFixed(3),
          balanceAfter: saved.onHand,
          documentRef: opts.documentRef ?? null,
          note: opts.note ?? null,
          createdBy: user.sub,
        }),
      );
      return { transaction: txn, balance: saved };
    });
  }

  // Khóa (hoặc tạo) dòng số dư để tính toán an toàn trước tranh chấp.
  private async lockBalance(
    m: import('typeorm').EntityManager,
    materialId: string,
    storageLocationId: string,
  ): Promise<StockBalance> {
    // Đảm bảo vật chất và kho tồn tại.
    const material = await m.query('SELECT 1 FROM materials WHERE id = $1', [materialId]);
    if (material.length === 0) throw new NotFoundException('DATA-001: Không tìm thấy vật chất');
    const loc = await m.query('SELECT 1 FROM storage_locations WHERE id = $1', [storageLocationId]);
    if (loc.length === 0) throw new NotFoundException('DATA-001: Không tìm thấy kho');

    let bal = await m
      .getRepository(StockBalance)
      .createQueryBuilder('sb')
      .setLock('pessimistic_write')
      .where('sb.material_id = :materialId AND sb.storage_location_id = :storageLocationId', {
        materialId,
        storageLocationId,
      })
      .getOne();
    if (!bal) {
      bal = await m.getRepository(StockBalance).save(
        m.getRepository(StockBalance).create({ materialId, storageLocationId, onHand: '0' }),
      );
    }
    return bal;
  }
}
