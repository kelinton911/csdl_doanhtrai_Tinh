import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UtilitySystem } from './entities/utility-system.entity';
import { UtilityReading } from './entities/utility-reading.entity';
import {
  CreateReadingDto,
  CreateUtilitySystemDto,
  KIND_CATEGORY,
  UpdateUtilitySystemDto,
} from './dto/utility.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface UtilityFilters {
  search?: string;
  category?: string;
  kind?: string;
  status?: string;
  barracksId?: string;
}

// M11 — Điện/Nước/Năng lượng. CRUD hệ thống + ghi chỉ số/tiêu thụ/chi phí + tổng hợp khả năng
// bảo đảm. Không xóa cứng (DECOMMISSIONED). Lọc theo phạm vi dữ liệu ở tầng server.
@Injectable()
export class UtilitiesService {
  constructor(
    @InjectRepository(UtilitySystem) private readonly repo: Repository<UtilitySystem>,
    @InjectRepository(UtilityReading) private readonly readings: Repository<UtilityReading>,
    private readonly ds: DataSource,
  ) {}

  async list(q: PaginationQuery, filters: UtilityFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('u')
      .leftJoin('barracks', 'b', 'b.id = u.barracks_id')
      .leftJoin('administrative_areas', 'a', 'a.id = u.area_id')
      .select('u.id', 'id')
      .addSelect('u.code', 'code')
      .addSelect('u.name', 'name')
      .addSelect('u.category', 'category')
      .addSelect('u.kind', 'kind')
      .addSelect('u.capacity', 'capacity')
      .addSelect('u.capacity_unit', 'capacityUnit')
      .addSelect('u.status', 'status')
      .addSelect('u.autonomy_hours', 'autonomyHours')
      .addSelect('u.next_maintenance_at', 'nextMaintenanceAt')
      .addSelect('u.updated_at', 'updatedAt')
      .addSelect('b.name', 'barracksName')
      .addSelect('a.name', 'areaName')
      .orderBy('u.category', 'ASC')
      .addOrderBy('u.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);

    const countQb = this.repo.createQueryBuilder('u');
    const apply = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(u.code ILIKE :s OR u.name ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.category) b.andWhere('u.category = :c', { c: filters.category });
      if (filters.kind) b.andWhere('u.kind = :k', { k: filters.kind });
      if (filters.status) b.andWhere('u.status = :st', { st: filters.status });
      if (filters.barracksId) b.andWhere('u.barracks_id = :bid', { bid: filters.barracksId });
      if (scope) b.andWhere('(u.area_id = ANY(:areaIds::uuid[]) OR u.organization_id = :orgId)', { areaIds: scope.areaIds, orgId: scope.organizationId });
    };
    apply(qb);
    apply(countQb);

    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    return paginated(
      rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        kind: r.kind,
        capacity: Number(r.capacity),
        capacityUnit: r.capacityUnit,
        status: r.status,
        autonomyHours: Number(r.autonomyHours),
        nextMaintenanceAt: r.nextMaintenanceAt,
        updatedAt: r.updatedAt,
        barracksName: r.barracksName,
        areaName: r.areaName,
      })),
      total,
      q,
    );
  }

  async get(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('DATA-001: Không tìm thấy hệ thống');
    const rows = await this.repo.query(
      `SELECT ST_AsGeoJSON(u.location) AS loc, b.name AS barracks_name, a.name AS area_name, o.name AS org_name,
              (SELECT COUNT(*) FROM utility_readings r WHERE r.utility_system_id = u.id) AS reading_count
       FROM utility_systems u
       LEFT JOIN barracks b ON b.id = u.barracks_id
       LEFT JOIN administrative_areas a ON a.id = u.area_id
       LEFT JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [id],
    );
    const r = rows?.[0] ?? {};
    return {
      ...found,
      location: r.loc ? JSON.parse(r.loc) : null,
      barracksName: r.barracks_name ?? null,
      areaName: r.area_name ?? null,
      orgName: r.org_name ?? null,
      readingCount: Number(r.reading_count ?? 0),
    };
  }

  private catFor(kind: string): string {
    const c = KIND_CATEGORY[kind];
    if (!c) throw new BadRequestException('VAL-001: Loại hệ thống không hợp lệ');
    return c;
  }

  // Lấy area/đơn vị từ doanh trại (nếu gắn) để phục vụ lọc theo địa bàn + phạm vi dữ liệu.
  private async barracksScopeIds(barracksId?: string): Promise<{ areaId: string | null; organizationId: string | null }> {
    if (!barracksId) return { areaId: null, organizationId: null };
    const rows = await this.repo.query('SELECT area_id, organization_id FROM barracks WHERE id = $1', [barracksId]);
    const r = rows?.[0];
    return { areaId: r?.area_id ?? null, organizationId: r?.organization_id ?? null };
  }

  async create(dto: CreateUtilitySystemDto, user: AuthUser): Promise<UtilitySystem> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã hệ thống ${dto.code}`);
    const category = this.catFor(dto.kind);
    const fromBarracks = await this.barracksScopeIds(dto.barracksId);
    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      category,
      kind: dto.kind,
      barracksId: dto.barracksId ?? null,
      areaId: dto.areaId ?? fromBarracks.areaId,
      organizationId: dto.organizationId ?? fromBarracks.organizationId ?? user.organizationId ?? null,
      capacity: (dto.capacity ?? 0).toString(),
      capacityUnit: dto.capacityUnit ?? null,
      reserveVolume: (dto.reserveVolume ?? 0).toString(),
      reserveUnit: dto.reserveUnit ?? null,
      fuelType: dto.fuelType ?? null,
      fuelLevel: (dto.fuelLevel ?? 0).toString(),
      autonomyHours: (dto.autonomyHours ?? 0).toString(),
      meterNo: dto.meterNo ?? null,
      status: dto.status ?? 'OPERATIONAL',
      lastMaintenanceAt: dto.lastMaintenanceAt ? new Date(dto.lastMaintenanceAt) : null,
      nextMaintenanceAt: dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : null,
      location: dto.location ?? null,
      notes: dto.notes ?? null,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateUtilitySystemDto, user: AuthUser): Promise<UtilitySystem> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy hệ thống');
    if (u.status === 'DECOMMISSIONED') throw new ConflictException('WF-001: Hệ thống đã ngừng, không thể sửa');
    if (dto.kind !== undefined) { u.kind = dto.kind; u.category = this.catFor(dto.kind); }
    if (dto.name !== undefined) u.name = dto.name;
    if (dto.barracksId !== undefined) {
      u.barracksId = dto.barracksId || null;
      const sc = await this.barracksScopeIds(dto.barracksId);
      if (dto.areaId === undefined) u.areaId = sc.areaId;
      if (dto.organizationId === undefined) u.organizationId = sc.organizationId;
    }
    if (dto.areaId !== undefined) u.areaId = dto.areaId || null;
    if (dto.organizationId !== undefined) u.organizationId = dto.organizationId || null;
    if (dto.capacity !== undefined) u.capacity = dto.capacity.toString();
    if (dto.capacityUnit !== undefined) u.capacityUnit = dto.capacityUnit || null;
    if (dto.reserveVolume !== undefined) u.reserveVolume = dto.reserveVolume.toString();
    if (dto.reserveUnit !== undefined) u.reserveUnit = dto.reserveUnit || null;
    if (dto.fuelType !== undefined) u.fuelType = dto.fuelType || null;
    if (dto.fuelLevel !== undefined) u.fuelLevel = dto.fuelLevel.toString();
    if (dto.autonomyHours !== undefined) u.autonomyHours = dto.autonomyHours.toString();
    if (dto.meterNo !== undefined) u.meterNo = dto.meterNo || null;
    if (dto.status !== undefined) u.status = dto.status;
    if (dto.lastMaintenanceAt !== undefined) u.lastMaintenanceAt = dto.lastMaintenanceAt ? new Date(dto.lastMaintenanceAt) : null;
    if (dto.nextMaintenanceAt !== undefined) u.nextMaintenanceAt = dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : null;
    if (dto.location !== undefined) u.location = dto.location;
    if (dto.notes !== undefined) u.notes = dto.notes || null;
    u.updatedBy = user.sub;
    return this.repo.save(u);
  }

  // Không xóa cứng — chuyển trạng thái DECOMMISSIONED, giữ nguyên lịch sử chỉ số.
  async decommission(id: string, reason: string | undefined, user: AuthUser): Promise<UtilitySystem> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy hệ thống');
    if (u.status === 'DECOMMISSIONED') throw new ConflictException('WF-001: Hệ thống đã ngừng');
    u.status = 'DECOMMISSIONED';
    u.notes = [u.notes, reason ? `Ngừng sử dụng: ${reason}` : null].filter(Boolean).join(' · ') || null;
    u.updatedBy = user.sub;
    return this.repo.save(u);
  }

  // ── Chỉ số/tiêu thụ ─────────────────────────────────────────
  async listReadings(systemId: string) {
    const rows = await this.readings.find({
      where: { utilitySystemId: systemId },
      order: { readingDate: 'DESC' },
      take: 60,
    });
    return rows.map((r) => ({
      id: r.id,
      readingDate: r.readingDate,
      indexValue: r.indexValue != null ? Number(r.indexValue) : null,
      consumption: r.consumption != null ? Number(r.consumption) : null,
      cost: r.cost != null ? Number(r.cost) : null,
      note: r.note,
    }));
  }

  async addReading(systemId: string, dto: CreateReadingDto, user: AuthUser) {
    const u = await this.repo.findOne({ where: { id: systemId } });
    if (!u) throw new NotFoundException('DATA-001: Không tìm thấy hệ thống');
    // Tự tính tiêu thụ từ chênh chỉ số so với kỳ gần nhất trước đó (nếu không nhập tay).
    let consumption = dto.consumption;
    if (consumption == null && dto.indexValue != null) {
      const prev = await this.readings
        .createQueryBuilder('r')
        .where('r.utility_system_id = :id', { id: systemId })
        .andWhere('r.index_value IS NOT NULL')
        .andWhere('r.reading_date < :d', { d: dto.readingDate })
        .orderBy('r.reading_date', 'DESC')
        .getOne();
      if (prev?.indexValue != null) {
        const diff = dto.indexValue - Number(prev.indexValue);
        if (diff >= 0) consumption = diff;
      }
    }
    return this.readings.save(
      this.readings.create({
        utilitySystemId: systemId,
        readingDate: dto.readingDate,
        indexValue: dto.indexValue != null ? dto.indexValue.toString() : null,
        consumption: consumption != null ? consumption.toString() : null,
        cost: dto.cost != null ? dto.cost.toString() : null,
        note: dto.note ?? null,
        createdBy: user.sub,
      }),
    );
  }

  // Tổng hợp khả năng bảo đảm điện/nước theo nhóm (dashboard hạ tầng).
  async summary(user?: AuthUser) {
    const scope = barracksScope(user);
    const scopeSql = scope ? `WHERE (area_id = ANY($1::uuid[]) OR organization_id = $2)` : '';
    const params = scope ? [scope.areaIds, scope.organizationId] : [];
    const rows = await this.ds.query(
      `SELECT category,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'OPERATIONAL')::int AS operational,
              COUNT(*) FILTER (WHERE status = 'FAULT')::int AS fault,
              COUNT(*) FILTER (WHERE status = 'MAINTENANCE')::int AS maintenance,
              COALESCE(MIN(NULLIF(autonomy_hours,0)),0)::numeric AS min_autonomy
       FROM utility_systems ${scopeSql}
       ${scopeSql ? 'AND' : 'WHERE'} status <> 'DECOMMISSIONED'
       GROUP BY category ORDER BY category`,
      params,
    );
    return {
      generatedAt: new Date().toISOString(),
      byCategory: rows.map((r: Record<string, unknown>) => ({
        category: r.category,
        total: Number(r.total),
        operational: Number(r.operational),
        fault: Number(r.fault),
        maintenance: Number(r.maintenance),
        minAutonomyHours: Number(r.min_autonomy),
      })),
    };
  }
}
