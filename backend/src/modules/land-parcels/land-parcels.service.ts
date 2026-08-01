import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LandParcel } from './entities/land-parcel.entity';
import { LandParcelRevision } from './entities/land-parcel-revision.entity';
import { LandParcelMarker } from './entities/land-parcel-marker.entity';
import {
  CreateLandParcelDto,
  CreateMarkerDto,
  ReviewDecisionDto,
  UpdateLandParcelDto,
} from './dto/land-parcel.dto';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
  transitionWithRevision,
} from '../../common/workflow-transition';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface LandParcelFilters {
  search?: string;
  usageStatus?: string;
  disputeStatus?: string;
  legalStatus?: string;
  areaId?: string;
  workflowStatus?: string;
}

// M04 — Khu đất quốc phòng. CRUD + workflow duyệt (không tự duyệt, không sửa bản chốt,
// không xóa cứng) + revision bất biến + mốc giới. Lọc theo phạm vi dữ liệu ở tầng server.
@Injectable()
export class LandParcelsService {
  constructor(
    @InjectRepository(LandParcel) private readonly repo: Repository<LandParcel>,
    @InjectRepository(LandParcelRevision) private readonly revisions: Repository<LandParcelRevision>,
    @InjectRepository(LandParcelMarker) private readonly markers: Repository<LandParcelMarker>,
    private readonly dataSource: DataSource,
  ) {}

  async list(q: PaginationQuery, filters: LandParcelFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoin('administrative_areas', 'a', 'a.id = p.area_id')
      .leftJoin('organizations', 'o', 'o.id = p.organization_id')
      .select('p.id', 'id')
      .addSelect('p.code', 'code')
      .addSelect('p.name', 'name')
      .addSelect('p.land_area', 'landArea')
      .addSelect('p.usage_status', 'usageStatus')
      .addSelect('p.legal_status', 'legalStatus')
      .addSelect('p.dispute_status', 'disputeStatus')
      .addSelect('p.workflow_status', 'workflowStatus')
      .addSelect('p.address', 'address')
      .addSelect('p.updated_at', 'updatedAt')
      .addSelect('a.name', 'areaName')
      .addSelect('o.name', 'orgName')
      .addSelect('ST_AsGeoJSON(p.location)', 'locationGeojson')
      .addSelect(
        (sub) => sub.select('COUNT(*)').from('land_parcel_markers', 'm').where('m.land_parcel_id = p.id'),
        'markerCount',
      )
      .orderBy('p.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);

    const countQb = this.repo.createQueryBuilder('p');
    const applyFilters = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(p.code ILIKE :s OR p.name ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.usageStatus) b.andWhere('p.usage_status = :us', { us: filters.usageStatus });
      if (filters.disputeStatus) b.andWhere('p.dispute_status = :ds', { ds: filters.disputeStatus });
      if (filters.legalStatus) b.andWhere('p.legal_status = :ls', { ls: filters.legalStatus });
      if (filters.workflowStatus) b.andWhere('p.workflow_status = :ws', { ws: filters.workflowStatus });
      if (filters.areaId) b.andWhere('p.area_id = :aid', { aid: filters.areaId });
      if (scope) {
        b.andWhere('(p.area_id = ANY(:areaIds::uuid[]) OR p.organization_id = :orgId)', {
          areaIds: scope.areaIds,
          orgId: scope.organizationId,
        });
      }
    };
    applyFilters(qb);
    applyFilters(countQb);

    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    const data = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      landArea: Number(r.landArea),
      usageStatus: r.usageStatus,
      legalStatus: r.legalStatus,
      disputeStatus: r.disputeStatus,
      workflowStatus: r.workflowStatus,
      address: r.address,
      updatedAt: r.updatedAt,
      areaName: r.areaName,
      orgName: r.orgName,
      markerCount: Number(r.markerCount),
      location: r.locationGeojson ? JSON.parse(r.locationGeojson) : null,
    }));
    return paginated(data, total, q);
  }

  async get(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('DATA-001: Không tìm thấy khu đất');
    const rows = await this.repo.query(
      `SELECT ST_AsGeoJSON(p.location) AS loc, ST_AsGeoJSON(p.boundary) AS bnd,
              a.name AS area_name, o.name AS org_name, b.name AS barracks_name,
              (SELECT COUNT(*) FROM land_parcel_markers m WHERE m.land_parcel_id = p.id) AS marker_count
       FROM land_parcels p
       LEFT JOIN administrative_areas a ON a.id = p.area_id
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN barracks b ON b.id = p.barracks_id
       WHERE p.id = $1`,
      [id],
    );
    const r = rows?.[0] ?? {};
    return {
      ...found,
      location: r.loc ? JSON.parse(r.loc) : null,
      boundary: r.bnd ? JSON.parse(r.bnd) : null,
      areaName: r.area_name ?? null,
      orgName: r.org_name ?? null,
      barracksName: r.barracks_name ?? null,
      markerCount: Number(r.marker_count ?? 0),
    };
  }

  async create(dto: CreateLandParcelDto, user: AuthUser): Promise<LandParcel> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã khu đất ${dto.code}`);
    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      areaId: dto.areaId ?? null,
      organizationId: dto.organizationId ?? user.organizationId ?? null,
      barracksId: dto.barracksId ?? null,
      address: dto.address ?? null,
      landArea: (dto.landArea ?? 0).toString(),
      landUseType: dto.landUseType ?? 'QUOC_PHONG',
      usageStatus: dto.usageStatus ?? 'IN_USE',
      legalStatus: dto.legalStatus ?? 'PENDING',
      legalOrigin: dto.legalOrigin ?? null,
      certificateNo: dto.certificateNo ?? null,
      disputeStatus: dto.disputeStatus ?? 'NONE',
      disputeNote: dto.disputeNote ?? null,
      accessRoad: dto.accessRoad ?? null,
      hasElectricity: dto.hasElectricity ?? false,
      hasWater: dto.hasWater ?? false,
      expansionCapability: dto.expansionCapability ?? null,
      safetyStatus: dto.safetyStatus ?? null,
      notes: dto.notes ?? null,
      location: dto.location ?? null,
      boundary: dto.boundary ?? null,
      workflowStatus: WorkflowStatus.DRAFT,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateLandParcelDto, user: AuthUser): Promise<LandParcel> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy khu đất');
    assertEditable(p.workflowStatus);
    const assign = <K extends keyof LandParcel>(k: K, v: LandParcel[K] | undefined) => {
      if (v !== undefined) p[k] = v;
    };
    assign('name', dto.name);
    assign('areaId', dto.areaId ?? undefined);
    assign('organizationId', dto.organizationId ?? undefined);
    assign('barracksId', dto.barracksId ?? undefined);
    assign('address', dto.address ?? undefined);
    if (dto.landArea !== undefined) p.landArea = dto.landArea.toString();
    assign('landUseType', dto.landUseType ?? undefined);
    assign('usageStatus', dto.usageStatus ?? undefined);
    assign('legalStatus', dto.legalStatus ?? undefined);
    assign('legalOrigin', dto.legalOrigin ?? undefined);
    assign('certificateNo', dto.certificateNo ?? undefined);
    assign('disputeStatus', dto.disputeStatus ?? undefined);
    assign('disputeNote', dto.disputeNote ?? undefined);
    assign('accessRoad', dto.accessRoad ?? undefined);
    assign('hasElectricity', dto.hasElectricity);
    assign('hasWater', dto.hasWater);
    assign('expansionCapability', dto.expansionCapability ?? undefined);
    assign('safetyStatus', dto.safetyStatus ?? undefined);
    assign('notes', dto.notes ?? undefined);
    if (dto.location !== undefined) p.location = dto.location;
    if (dto.boundary !== undefined) p.boundary = dto.boundary;
    p.updatedBy = user.sub;
    return this.repo.save(p);
  }

  async submit(id: string, user: AuthUser): Promise<LandParcel> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy khu đất');
    assertEditable(p.workflowStatus, 'gửi duyệt');
    return this.transition(p, WorkflowStatus.PENDING_REVIEW, user);
  }

  async approve(id: string, user: AuthUser): Promise<LandParcel> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy khu đất');
    assertPendingReview(p.workflowStatus);
    assertNotSelfApprove(p.createdBy, user.sub);
    return this.transition(p, WorkflowStatus.APPROVED, user);
  }

  async requestChanges(id: string, _dto: ReviewDecisionDto, user: AuthUser): Promise<LandParcel> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy khu đất');
    assertPendingReview(p.workflowStatus, 'yêu cầu bổ sung');
    return this.transition(p, WorkflowStatus.CHANGES_REQUESTED, user);
  }

  async listRevisions(id: string): Promise<LandParcelRevision[]> {
    return this.revisions.find({ where: { landParcelId: id }, order: { revisionNo: 'DESC' } });
  }

  // ── Mốc giới ────────────────────────────────────────────────
  async listMarkers(parcelId: string) {
    const rows = await this.repo.query(
      `SELECT id, code, note, created_at, ST_AsGeoJSON(location) AS loc
       FROM land_parcel_markers WHERE land_parcel_id = $1 ORDER BY code ASC`,
      [parcelId],
    );
    return rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      code: r.code,
      note: r.note,
      createdAt: r.created_at,
      location: r.loc ? JSON.parse(r.loc as string) : null,
    }));
  }

  async addMarker(parcelId: string, dto: CreateMarkerDto, user: AuthUser) {
    const parcel = await this.repo.findOne({ where: { id: parcelId } });
    if (!parcel) throw new NotFoundException('DATA-001: Không tìm thấy khu đất');
    const dup = await this.markers.findOne({ where: { landParcelId: parcelId, code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng số hiệu mốc ${dto.code}`);
    return this.markers.save(
      this.markers.create({
        landParcelId: parcelId,
        code: dto.code,
        note: dto.note ?? null,
        location: dto.location ?? null,
        createdBy: user.sub,
      }),
    );
  }

  async removeMarker(parcelId: string, markerId: string) {
    const m = await this.markers.findOne({ where: { id: markerId, landParcelId: parcelId } });
    if (!m) throw new NotFoundException('DATA-001: Không tìm thấy mốc giới');
    await this.markers.remove(m);
    return { deleted: true };
  }

  private async transition(p: LandParcel, to: WorkflowStatus, user: AuthUser): Promise<LandParcel> {
    return transitionWithRevision(
      {
        dataSource: this.dataSource,
        entityTarget: LandParcel,
        revisionTarget: LandParcelRevision,
        fkColumn: 'landParcelId',
        buildPayload: (saved) => ({
          code: saved.code,
          name: saved.name,
          areaId: saved.areaId,
          organizationId: saved.organizationId,
          landArea: saved.landArea,
          usageStatus: saved.usageStatus,
          legalStatus: saved.legalStatus,
          disputeStatus: saved.disputeStatus,
        }),
      },
      p,
      to,
      user.sub,
    );
  }
}
