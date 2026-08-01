import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LocalResource } from './entities/local-resource.entity';
import {
  CreateLocalResourceDto,
  RESOURCE_TYPE_CATEGORY,
  UpdateLocalResourceDto,
} from './dto/local-resource.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface ResourceFilters {
  search?: string;
  category?: string;
  resourceType?: string;
  mobilizationTime?: string;
  reliability?: string;
  agreementStatus?: string;
  areaId?: string;
  status?: string;
}

// M16 — Nguồn lực huy động tại địa phương. CRUD + tìm nguồn gần đơn vị (PostGIS) để chọn
// nguồn tối ưu theo khoảng cách/thời gian/độ tin cậy. Không xóa cứng (INACTIVE).
@Injectable()
export class LocalResourcesService {
  constructor(
    @InjectRepository(LocalResource) private readonly repo: Repository<LocalResource>,
    private readonly ds: DataSource,
  ) {}

  private catFor(type: string): string {
    const c = RESOURCE_TYPE_CATEGORY[type];
    if (!c) throw new BadRequestException('VAL-001: Loại nguồn lực không hợp lệ');
    return c;
  }

  async list(q: PaginationQuery, filters: ResourceFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('r')
      .leftJoin('administrative_areas', 'a', 'a.id = r.area_id')
      .select('r.id', 'id')
      .addSelect('r.code', 'code')
      .addSelect('r.name', 'name')
      .addSelect('r.category', 'category')
      .addSelect('r.resource_type', 'resourceType')
      .addSelect('r.owner_name', 'ownerName')
      .addSelect('r.mobilization_time', 'mobilizationTime')
      .addSelect('r.reliability', 'reliability')
      .addSelect('r.agreement_status', 'agreementStatus')
      .addSelect('r.agreement_valid_until', 'agreementValidUntil')
      .addSelect('r.capacity_qty', 'capacityQty')
      .addSelect('r.capacity_unit', 'capacityUnit')
      .addSelect('r.status', 'status')
      .addSelect('a.name', 'areaName')
      .addSelect('ST_AsGeoJSON(r.location)', 'locationGeojson')
      .orderBy('r.category', 'ASC')
      .addOrderBy('r.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);

    const countQb = this.repo.createQueryBuilder('r');
    const apply = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(r.code ILIKE :s OR r.name ILIKE :s OR r.owner_name ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.category) b.andWhere('r.category = :c', { c: filters.category });
      if (filters.resourceType) b.andWhere('r.resource_type = :rt', { rt: filters.resourceType });
      if (filters.mobilizationTime) b.andWhere('r.mobilization_time = :mt', { mt: filters.mobilizationTime });
      if (filters.reliability) b.andWhere('r.reliability = :rl', { rl: filters.reliability });
      if (filters.agreementStatus) b.andWhere('r.agreement_status = :ag', { ag: filters.agreementStatus });
      if (filters.areaId) b.andWhere('r.area_id = :aid', { aid: filters.areaId });
      b.andWhere('r.status = :st', { st: filters.status || 'ACTIVE' });
      // Data-scope tầng service: bảng chỉ mang area_id (không có organization_id) nên
      // giới hạn theo địa bàn được giao; null = xem toàn tỉnh.
      if (scope) b.andWhere('r.area_id = ANY(:areaIds::uuid[])', { areaIds: scope.areaIds });
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
        resourceType: r.resourceType,
        ownerName: r.ownerName,
        mobilizationTime: r.mobilizationTime,
        reliability: r.reliability,
        agreementStatus: r.agreementStatus,
        agreementValidUntil: r.agreementValidUntil,
        capacityQty: Number(r.capacityQty),
        capacityUnit: r.capacityUnit,
        status: r.status,
        areaName: r.areaName,
        location: r.locationGeojson ? JSON.parse(r.locationGeojson) : null,
      })),
      total,
      q,
    );
  }

  async get(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('DATA-001: Không tìm thấy nguồn lực');
    const rows = await this.repo.query(
      `SELECT ST_AsGeoJSON(r.location) AS loc, a.name AS area_name
       FROM local_resources r LEFT JOIN administrative_areas a ON a.id = r.area_id WHERE r.id = $1`,
      [id],
    );
    const r = rows?.[0] ?? {};
    return { ...found, location: r.loc ? JSON.parse(r.loc) : null, areaName: r.area_name ?? null };
  }

  async create(dto: CreateLocalResourceDto, user: AuthUser): Promise<LocalResource> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã nguồn lực ${dto.code}`);
    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      category: this.catFor(dto.resourceType),
      resourceType: dto.resourceType,
      ownerName: dto.ownerName ?? null,
      ownerType: dto.ownerType ?? null,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      areaId: dto.areaId ?? null,
      address: dto.address ?? null,
      location: dto.location ?? null,
      capacityDesc: dto.capacityDesc ?? null,
      capacityQty: (dto.capacityQty ?? 0).toString(),
      capacityUnit: dto.capacityUnit ?? null,
      mobilizationTime: dto.mobilizationTime ?? 'MEDIUM',
      reliability: dto.reliability ?? 'MEDIUM',
      agreementNo: dto.agreementNo ?? null,
      agreementValidUntil: dto.agreementValidUntil ?? null,
      agreementStatus: dto.agreementStatus ?? (dto.agreementNo ? 'SIGNED' : 'NONE'),
      surveyedAt: dto.surveyedAt ?? null,
      surveyNote: dto.surveyNote ?? null,
      notes: dto.notes ?? null,
      status: 'ACTIVE',
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateLocalResourceDto, user: AuthUser): Promise<LocalResource> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('DATA-001: Không tìm thấy nguồn lực');
    if (r.status === 'INACTIVE') throw new ConflictException('WF-001: Nguồn lực đã ngừng theo dõi, không thể sửa');
    if (dto.resourceType !== undefined) { r.resourceType = dto.resourceType; r.category = this.catFor(dto.resourceType); }
    if (dto.name !== undefined) r.name = dto.name;
    if (dto.ownerName !== undefined) r.ownerName = dto.ownerName || null;
    if (dto.ownerType !== undefined) r.ownerType = dto.ownerType || null;
    if (dto.contactName !== undefined) r.contactName = dto.contactName || null;
    if (dto.contactPhone !== undefined) r.contactPhone = dto.contactPhone || null;
    if (dto.areaId !== undefined) r.areaId = dto.areaId || null;
    if (dto.address !== undefined) r.address = dto.address || null;
    if (dto.location !== undefined) r.location = dto.location;
    if (dto.capacityDesc !== undefined) r.capacityDesc = dto.capacityDesc || null;
    if (dto.capacityQty !== undefined) r.capacityQty = dto.capacityQty.toString();
    if (dto.capacityUnit !== undefined) r.capacityUnit = dto.capacityUnit || null;
    if (dto.mobilizationTime !== undefined) r.mobilizationTime = dto.mobilizationTime;
    if (dto.reliability !== undefined) r.reliability = dto.reliability;
    if (dto.agreementNo !== undefined) r.agreementNo = dto.agreementNo || null;
    if (dto.agreementValidUntil !== undefined) r.agreementValidUntil = dto.agreementValidUntil || null;
    if (dto.agreementStatus !== undefined) r.agreementStatus = dto.agreementStatus;
    if (dto.surveyedAt !== undefined) r.surveyedAt = dto.surveyedAt || null;
    if (dto.surveyNote !== undefined) r.surveyNote = dto.surveyNote || null;
    if (dto.notes !== undefined) r.notes = dto.notes || null;
    r.updatedBy = user.sub;
    return this.repo.save(r);
  }

  async deactivate(id: string, reason: string | undefined, user: AuthUser): Promise<LocalResource> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('DATA-001: Không tìm thấy nguồn lực');
    if (r.status === 'INACTIVE') throw new ConflictException('WF-001: Nguồn lực đã ngừng theo dõi');
    r.status = 'INACTIVE';
    r.notes = [r.notes, reason ? `Ngừng theo dõi: ${reason}` : null].filter(Boolean).join(' · ') || null;
    r.updatedBy = user.sub;
    return this.repo.save(r);
  }

  // Tìm nguồn lực gần một vị trí (chọn nguồn tối ưu theo khoảng cách). Nếu có barracksId,
  // lấy toạ độ doanh trại làm tâm. Trả về sắp xếp theo khoảng cách tăng dần (km).
  async nearby(opts: {
    lat?: number;
    lng?: number;
    barracksId?: string;
    radiusKm?: number;
    resourceType?: string;
    category?: string;
    limit?: number;
  }) {
    let { lat, lng } = opts;
    if ((lat == null || lng == null) && opts.barracksId) {
      const b = await this.ds.query('SELECT ST_Y(location) AS lat, ST_X(location) AS lng FROM barracks WHERE id = $1', [opts.barracksId]);
      if (b?.[0]?.lat != null) { lat = Number(b[0].lat); lng = Number(b[0].lng); }
    }
    if (lat == null || lng == null) throw new BadRequestException('VAL-001: Thiếu toạ độ (lat/lng) hoặc barracksId có toạ độ');
    const radiusM = Math.min(Math.max((opts.radiusKm ?? 30), 1), 300) * 1000;
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const params: unknown[] = [lng, lat, radiusM];
    let typeCond = '';
    if (opts.resourceType) { params.push(opts.resourceType); typeCond += ` AND r.resource_type = $${params.length}`; }
    if (opts.category) { params.push(opts.category); typeCond += ` AND r.category = $${params.length}`; }
    params.push(limit);
    const rows = await this.ds.query(
      `SELECT r.id, r.code, r.name, r.category, r.resource_type AS "resourceType",
              r.owner_name AS "ownerName", r.mobilization_time AS "mobilizationTime",
              r.reliability, r.capacity_qty AS "capacityQty", r.capacity_unit AS "capacityUnit",
              ST_AsGeoJSON(r.location) AS loc,
              ST_Distance(r.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS dist_m
       FROM local_resources r
       WHERE r.status = 'ACTIVE' AND r.location IS NOT NULL
         AND ST_DWithin(r.location::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
         ${typeCond}
       ORDER BY dist_m ASC
       LIMIT $${params.length}`,
      params,
    );
    return {
      center: { lat, lng },
      radiusKm: radiusM / 1000,
      count: rows.length,
      resources: rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        category: r.category,
        resourceType: r.resourceType,
        ownerName: r.ownerName,
        mobilizationTime: r.mobilizationTime,
        reliability: r.reliability,
        capacityQty: Number(r.capacityQty),
        capacityUnit: r.capacityUnit,
        distanceKm: Math.round((Number(r.dist_m) / 1000) * 100) / 100,
        location: r.loc ? JSON.parse(r.loc as string) : null,
      })),
    };
  }
}
