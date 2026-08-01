import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeploymentSite } from './entities/deployment-site.entity';
import { RecoveryTask } from './entities/recovery-task.entity';
import {
  CreateRecoveryDto,
  CreateSiteDto,
  RECOVERY_STATUSES,
  UpdateRecoveryDto,
  UpdateSiteDto,
} from './dto/readiness.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface SiteFilters { search?: string; siteType?: string; readiness?: string; role?: string; areaId?: string; }
export interface RecoveryFilters { search?: string; status?: string; severity?: string; dangerZone?: string; scenario?: string; }

// M18/M19 — Sẵn sàng chiến đấu & bảo đảm tác chiến: địa điểm sơ tán/phân tán/dự bị + khắc phục hậu quả.
@Injectable()
export class ReadinessService {
  constructor(
    @InjectRepository(DeploymentSite) private readonly sites: Repository<DeploymentSite>,
    @InjectRepository(RecoveryTask) private readonly recovery: Repository<RecoveryTask>,
    private readonly ds: DataSource,
  ) {}

  // ── M18: Địa điểm bố trí/sơ tán ──────────────────────────────
  async listSites(q: PaginationQuery, f: SiteFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.sites.createQueryBuilder('s')
      .leftJoin('administrative_areas', 'a', 'a.id = s.area_id')
      .select('s.id', 'id').addSelect('s.code', 'code').addSelect('s.name', 'name')
      .addSelect('s.site_type', 'siteType').addSelect('s.capacity', 'capacity')
      .addSelect('s.readiness', 'readiness').addSelect('s.role', 'role')
      .addSelect('s.deploy_time_hours', 'deployTimeHours').addSelect('s.status', 'status')
      .addSelect('s.updated_at', 'updatedAt').addSelect('a.name', 'areaName')
      .addSelect('ST_AsGeoJSON(s.location)', 'locationGeojson')
      .orderBy('s.code', 'ASC').offset(q.skip).limit(q.size);
    const countQb = this.sites.createQueryBuilder('s');
    const apply = (b: typeof qb | typeof countQb) => {
      if (f.search) b.andWhere('(s.code ILIKE :x OR s.name ILIKE :x)', { x: `%${f.search}%` });
      if (f.siteType) b.andWhere('s.site_type = :t', { t: f.siteType });
      if (f.readiness) b.andWhere('s.readiness = :r', { r: f.readiness });
      if (f.role) b.andWhere('s.role = :ro', { ro: f.role });
      if (f.areaId) b.andWhere('s.area_id = :aid', { aid: f.areaId });
      b.andWhere("s.status = 'ACTIVE'");
      // Data-scope: địa điểm chỉ mang area_id → giới hạn theo địa bàn; null = toàn tỉnh.
      if (scope) b.andWhere('s.area_id = ANY(:areaIds::uuid[])', { areaIds: scope.areaIds });
    };
    apply(qb); apply(countQb);
    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    return paginated(rows.map((r) => ({
      id: r.id, code: r.code, name: r.name, siteType: r.siteType, capacity: Number(r.capacity),
      readiness: r.readiness, role: r.role, deployTimeHours: Number(r.deployTimeHours), status: r.status,
      updatedAt: r.updatedAt, areaName: r.areaName, location: r.locationGeojson ? JSON.parse(r.locationGeojson) : null,
    })), total, q);
  }

  async getSite(id: string) {
    const s = await this.sites.findOne({ where: { id } });
    if (!s) throw new NotFoundException('DATA-001: Không tìm thấy địa điểm');
    const rows = await this.sites.query(
      `SELECT ST_AsGeoJSON(s.location) AS loc, a.name AS area_name FROM deployment_sites s
       LEFT JOIN administrative_areas a ON a.id = s.area_id WHERE s.id = $1`, [id]);
    const r = rows?.[0] ?? {};
    return { ...s, location: r.loc ? JSON.parse(r.loc) : null, areaName: r.area_name ?? null };
  }

  async createSite(dto: CreateSiteDto, user: AuthUser): Promise<DeploymentSite> {
    if (await this.sites.findOne({ where: { code: dto.code } })) throw new ConflictException(`DATA-003: Trùng mã địa điểm ${dto.code}`);
    return this.sites.save(this.sites.create({
      code: dto.code, name: dto.name, siteType: dto.siteType ?? 'EVACUATION', areaId: dto.areaId ?? null,
      address: dto.address ?? null, location: dto.location ?? null, capacity: dto.capacity ?? 0,
      concealment: dto.concealment ?? null, accessRoad: dto.accessRoad ?? null, hasPower: dto.hasPower ?? false, hasWater: dto.hasWater ?? false,
      tentCapability: dto.tentCapability ?? 0, deployTimeHours: (dto.deployTimeHours ?? 0).toString(),
      readiness: dto.readiness ?? 'PARTIAL', role: dto.role ?? 'PRIMARY', defenseState: dto.defenseState ?? 'SSCD',
      notes: dto.notes ?? null, status: 'ACTIVE', createdBy: user.sub, updatedBy: user.sub,
    }));
  }

  async updateSite(id: string, dto: UpdateSiteDto, user: AuthUser): Promise<DeploymentSite> {
    const s = await this.sites.findOne({ where: { id } });
    if (!s) throw new NotFoundException('DATA-001: Không tìm thấy địa điểm');
    if (s.status === 'INACTIVE') throw new ConflictException('WF-001: Địa điểm đã ngừng, không thể sửa');
    if (dto.name !== undefined) s.name = dto.name;
    if (dto.siteType !== undefined) s.siteType = dto.siteType;
    if (dto.areaId !== undefined) s.areaId = dto.areaId || null;
    if (dto.address !== undefined) s.address = dto.address || null;
    if (dto.location !== undefined) s.location = dto.location;
    if (dto.capacity !== undefined) s.capacity = dto.capacity;
    if (dto.concealment !== undefined) s.concealment = dto.concealment || null;
    if (dto.accessRoad !== undefined) s.accessRoad = dto.accessRoad || null;
    if (dto.hasPower !== undefined) s.hasPower = dto.hasPower;
    if (dto.hasWater !== undefined) s.hasWater = dto.hasWater;
    if (dto.tentCapability !== undefined) s.tentCapability = dto.tentCapability;
    if (dto.deployTimeHours !== undefined) s.deployTimeHours = dto.deployTimeHours.toString();
    if (dto.readiness !== undefined) s.readiness = dto.readiness;
    if (dto.role !== undefined) s.role = dto.role;
    if (dto.defenseState !== undefined) s.defenseState = dto.defenseState;
    if (dto.notes !== undefined) s.notes = dto.notes || null;
    s.updatedBy = user.sub;
    return this.sites.save(s);
  }

  async deactivateSite(id: string, reason: string | undefined, user: AuthUser): Promise<DeploymentSite> {
    const s = await this.sites.findOne({ where: { id } });
    if (!s) throw new NotFoundException('DATA-001: Không tìm thấy địa điểm');
    if (s.status === 'INACTIVE') throw new ConflictException('WF-001: Địa điểm đã ngừng');
    s.status = 'INACTIVE';
    s.notes = [s.notes, reason ? `Ngừng: ${reason}` : null].filter(Boolean).join(' · ') || null;
    s.updatedBy = user.sub;
    return this.sites.save(s);
  }

  // M18 — Nhu cầu–khả năng–thiếu hụt theo địa bàn: sức chứa doanh trại (tại chỗ) + địa điểm sơ tán.
  async assuranceByArea() {
    const rows = await this.ds.query(`
      SELECT a.id, a.code, a.name, a.type,
        (SELECT COALESCE(SUM(b.declared_capacity),0) FROM barracks b WHERE b.area_id=a.id AND b.workflow_status='APPROVED')::int AS barracks_capacity,
        (SELECT COALESCE(SUM(s.capacity),0) FROM deployment_sites s WHERE s.area_id=a.id AND s.status='ACTIVE')::int AS site_capacity,
        (SELECT COUNT(*) FROM deployment_sites s WHERE s.area_id=a.id AND s.status='ACTIVE')::int AS site_count,
        (SELECT COUNT(*) FROM deployment_sites s WHERE s.area_id=a.id AND s.status='ACTIVE' AND s.readiness='READY')::int AS ready_sites
      FROM administrative_areas a
      WHERE a.status='ACTIVE' AND a.type IN ('COMMUNE','WARD','SPECIAL_ZONE')
        AND (EXISTS (SELECT 1 FROM barracks b WHERE b.area_id=a.id) OR EXISTS (SELECT 1 FROM deployment_sites s WHERE s.area_id=a.id))
      ORDER BY a.code ASC`);
    return {
      generatedAt: new Date().toISOString(),
      areas: rows.map((r: Record<string, unknown>) => ({
        id: r.id, code: r.code, name: r.name, type: r.type,
        barracksCapacity: Number(r.barracks_capacity), siteCapacity: Number(r.site_capacity),
        totalCapacity: Number(r.barracks_capacity) + Number(r.site_capacity),
        siteCount: Number(r.site_count), readySites: Number(r.ready_sites),
      })),
    };
  }

  // ── M19: Khắc phục hậu quả ──────────────────────────────────
  async listRecovery(q: PaginationQuery, f: RecoveryFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.recovery.createQueryBuilder('r')
      .leftJoin('administrative_areas', 'a', 'a.id = r.area_id')
      .leftJoin('barracks', 'b', 'b.id = r.barracks_id')
      .select('r.id', 'id').addSelect('r.code', 'code').addSelect('r.title', 'title')
      .addSelect('r.severity', 'severity').addSelect('r.danger_zone', 'dangerZone')
      .addSelect('r.status', 'status').addSelect('r.scenario', 'scenario')
      .addSelect('r.estimated_loss', 'estimatedLoss').addSelect('r.updated_at', 'updatedAt')
      .addSelect('COALESCE(b.name, a.name)', 'targetName')
      .orderBy(`CASE r.severity WHEN 'DESTROYED' THEN 0 WHEN 'HEAVY' THEN 1 WHEN 'MODERATE' THEN 2 ELSE 3 END`, 'ASC')
      .addOrderBy('r.created_at', 'DESC').offset(q.skip).limit(q.size);
    const countQb = this.recovery.createQueryBuilder('r');
    const apply = (b: typeof qb | typeof countQb) => {
      if (f.search) b.andWhere('(r.code ILIKE :x OR r.title ILIKE :x)', { x: `%${f.search}%` });
      if (f.status) b.andWhere('r.status = :st', { st: f.status });
      if (f.severity) b.andWhere('r.severity = :sv', { sv: f.severity });
      if (f.dangerZone === 'true') b.andWhere('r.danger_zone = true');
      if (f.scenario === 'true') b.andWhere('r.scenario = true');
      else if (f.scenario === 'false') b.andWhere('r.scenario = false');
      // Data-scope: nhiệm vụ khắc phục có thể gắn địa bàn (area_id) hoặc doanh trại (barracks_id).
      // Cho phép nếu địa bàn thuộc phạm vi, hoặc doanh trại nằm trong địa bàn/đơn vị được giao.
      if (scope) {
        b.andWhere(
          '(r.area_id = ANY(:areaIds::uuid[]) OR r.barracks_id IN ' +
            '(SELECT bs.id FROM barracks bs WHERE bs.area_id = ANY(:areaIds::uuid[]) OR bs.organization_id = :orgId))',
          { areaIds: scope.areaIds, orgId: scope.organizationId },
        );
      }
    };
    apply(qb); apply(countQb);
    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    return paginated(rows.map((r) => ({
      id: r.id, code: r.code, title: r.title, severity: r.severity, dangerZone: r.dangerZone,
      status: r.status, scenario: r.scenario, estimatedLoss: Number(r.estimatedLoss), updatedAt: r.updatedAt, targetName: r.targetName,
    })), total, q);
  }

  async getRecovery(id: string) {
    const r = await this.recovery.findOne({ where: { id } });
    if (!r) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ khắc phục');
    const rows = await this.recovery.query(
      `SELECT ST_AsGeoJSON(r.location) AS loc, a.name AS area_name, b.name AS barracks_name FROM recovery_tasks r
       LEFT JOIN administrative_areas a ON a.id = r.area_id LEFT JOIN barracks b ON b.id = r.barracks_id WHERE r.id = $1`, [id]);
    const x = rows?.[0] ?? {};
    return { ...r, location: x.loc ? JSON.parse(x.loc) : null, areaName: x.area_name ?? null, barracksName: x.barracks_name ?? null };
  }

  async createRecovery(dto: CreateRecoveryDto, user: AuthUser): Promise<RecoveryTask> {
    if (await this.recovery.findOne({ where: { code: dto.code } })) throw new ConflictException(`DATA-003: Trùng mã ${dto.code}`);
    return this.recovery.save(this.recovery.create({
      code: dto.code, title: dto.title, severity: dto.severity ?? 'MODERATE', dangerZone: dto.dangerZone ?? false,
      damageEventId: dto.damageEventId ?? null, barracksId: dto.barracksId ?? null, areaId: dto.areaId ?? null, location: dto.location ?? null,
      description: dto.description ?? null, neededMaterials: dto.neededMaterials ?? null, neededForces: dto.neededForces ?? null,
      assignedNote: dto.assignedNote ?? null, estimatedLoss: (dto.estimatedLoss ?? 0).toString(),
      status: 'ASSESSING', occurredAt: new Date(), scenario: dto.scenario ?? false, createdBy: user.sub, updatedBy: user.sub,
    }));
  }

  async updateRecovery(id: string, dto: UpdateRecoveryDto, user: AuthUser): Promise<RecoveryTask> {
    const r = await this.recovery.findOne({ where: { id } });
    if (!r) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ khắc phục');
    if (r.status === 'RECOVERED') throw new ConflictException('WF-001: Đã khắc phục xong, không sửa');
    if (dto.title !== undefined) r.title = dto.title;
    if (dto.severity !== undefined) r.severity = dto.severity;
    if (dto.dangerZone !== undefined) r.dangerZone = dto.dangerZone;
    if (dto.barracksId !== undefined) r.barracksId = dto.barracksId || null;
    if (dto.areaId !== undefined) r.areaId = dto.areaId || null;
    if (dto.location !== undefined) r.location = dto.location;
    if (dto.description !== undefined) r.description = dto.description || null;
    if (dto.neededMaterials !== undefined) r.neededMaterials = dto.neededMaterials || null;
    if (dto.neededForces !== undefined) r.neededForces = dto.neededForces || null;
    if (dto.assignedNote !== undefined) r.assignedNote = dto.assignedNote || null;
    if (dto.estimatedLoss !== undefined) r.estimatedLoss = dto.estimatedLoss.toString();
    r.updatedBy = user.sub;
    return this.recovery.save(r);
  }

  async setRecoveryStatus(id: string, status: string, note: string | undefined, user: AuthUser): Promise<RecoveryTask> {
    if (!RECOVERY_STATUSES.includes(status as never)) throw new BadRequestException('VAL-001: Trạng thái không hợp lệ');
    const r = await this.recovery.findOne({ where: { id } });
    if (!r) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ khắc phục');
    r.status = status;
    if (status === 'RECOVERED') { r.resolvedAt = new Date(); r.dangerZone = false; }
    if (note) r.assignedNote = [r.assignedNote, note].filter(Boolean).join(' · ');
    r.updatedBy = user.sub;
    return this.recovery.save(r);
  }

  async summary() {
    const [site] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE status='ACTIVE')::int total,
              COUNT(*) FILTER (WHERE status='ACTIVE' AND readiness='READY')::int ready,
              COUNT(*) FILTER (WHERE status='ACTIVE' AND readiness='NOT_READY')::int not_ready,
              COALESCE(SUM(capacity) FILTER (WHERE status='ACTIVE'),0)::int capacity FROM deployment_sites`);
    const [rec] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE status<>'RECOVERED')::int open,
              COUNT(*) FILTER (WHERE status<>'RECOVERED' AND danger_zone=true)::int danger_zones,
              COUNT(*) FILTER (WHERE status<>'RECOVERED' AND severity IN ('HEAVY','DESTROYED'))::int heavy FROM recovery_tasks`);
    return {
      generatedAt: new Date().toISOString(),
      sites: { total: Number(site.total), ready: Number(site.ready), notReady: Number(site.not_ready), capacity: Number(site.capacity) },
      recovery: { open: Number(rec.open), dangerZones: Number(rec.danger_zones), heavy: Number(rec.heavy) },
    };
  }
}
