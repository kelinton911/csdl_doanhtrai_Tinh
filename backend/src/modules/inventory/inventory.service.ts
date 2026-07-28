import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StorageLocation } from './entities/storage-location.entity';
import { InventoryTransaction, TxType } from './entities/inventory-transaction.entity';
import { StockBalance } from './entities/stock-balance.entity';
import {
  AdjustmentDto,
  CreateStorageLocationDto,
  CreateTransactionDto,
} from './dto/inventory.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

// M06 — Inventory. UC-08: tồn kho và vị trí lưu giữ. Sổ kho bất biến; điều chỉnh bằng
// bút toán mới; không cho tồn âm nếu không có quyền ngoại lệ.
@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StorageLocation)
    private readonly locations: Repository<StorageLocation>,
    @InjectRepository(InventoryTransaction)
    private readonly txns: Repository<InventoryTransaction>,
    @InjectRepository(StockBalance)
    private readonly balances: Repository<StockBalance>,
    private readonly dataSource: DataSource,
  ) {}

  // ------- Kho -------
  async listLocations(q: PaginationQuery) {
    const [data, total] = await this.locations.findAndCount({
      order: { code: 'ASC' },
      skip: q.skip,
      take: q.size,
    });
    return paginated(data, total, q);
  }

  async createLocation(dto: CreateStorageLocationDto, user: AuthUser) {
    const dup = await this.locations.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã kho ${dto.code}`);
    return this.locations.save(
      this.locations.create({
        code: dto.code,
        name: dto.name,
        type: dto.type ?? null,
        barracksId: dto.barracksId ?? null,
        status: 'ACTIVE',
        createdBy: user.sub,
      }),
    );
  }

  // ------- Số dư tồn -------
  async listBalances(
    q: PaginationQuery,
    filters: { storageLocationId?: string; materialId?: string },
  ) {
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
      .from(StockBalance, 'sb')
      .leftJoin('materials', 'm', 'm.id = sb.material_id')
      .leftJoin('storage_locations', 'l', 'l.id = sb.storage_location_id')
      .orderBy('m.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);
    if (filters.storageLocationId)
      qb.andWhere('sb.storage_location_id = :loc', { loc: filters.storageLocationId });
    if (filters.materialId)
      qb.andWhere('sb.material_id = :mat', { mat: filters.materialId });

    const rows = await qb.getRawMany();
    const countQb = this.balances.createQueryBuilder('sb');
    if (filters.storageLocationId)
      countQb.andWhere('sb.storage_location_id = :loc', { loc: filters.storageLocationId });
    if (filters.materialId) countQb.andWhere('sb.material_id = :mat', { mat: filters.materialId });
    const total = await countQb.getCount();

    const data = rows.map((r) => ({
      ...r,
      onHand: Number(r.onHand),
      lastCounted: r.lastCounted !== null ? Number(r.lastCounted) : null,
      variance: r.lastCounted !== null ? Number(r.lastCounted) - Number(r.onHand) : null,
    }));
    return paginated(data, total, q);
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
