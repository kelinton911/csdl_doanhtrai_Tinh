import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Barracks } from './entities/barracks.entity';
import { BarracksRevision } from './entities/barracks-revision.entity';
import {
  CreateBarracksDto,
  ReviewDecisionDto,
  UpdateBarracksDto,
} from './dto/barracks.dto';
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

// M04 — Barracks. UC-05 (tạo/cập nhật), UC-06 (duyệt). Quy tắc trọng yếu:
// mã duy nhất toàn tỉnh; không sửa trực tiếp bản APPROVED; không xóa cứng;
// người lập không tự duyệt (phân tách nhiệm vụ).
@Injectable()
export class BarracksService {
  constructor(
    @InjectRepository(Barracks) private readonly repo: Repository<Barracks>,
    @InjectRepository(BarracksRevision)
    private readonly revisions: Repository<BarracksRevision>,
    private readonly dataSource: DataSource,
  ) {}

  // Danh sách kèm tên xã/đơn vị, số công trình, và toạ độ GeoJSON (màn danh sách + bản đồ).
  // Lọc theo phạm vi dữ liệu người dùng (data-scope) ở TẦNG SERVER.
  async list(q: PaginationQuery, search?: string, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('b')
      .leftJoin('administrative_areas', 'a', 'a.id = b.area_id')
      .leftJoin('organizations', 'o', 'o.id = b.organization_id')
      .select('b.id', 'id')
      .addSelect('b.code', 'code')
      .addSelect('b.name', 'name')
      .addSelect('b.workflow_status', 'workflowStatus')
      .addSelect('b.declared_capacity', 'declaredCapacity')
      .addSelect('b.land_area', 'landArea')
      .addSelect('b.address', 'address')
      .addSelect('b.updated_at', 'updatedAt')
      .addSelect('a.name', 'areaName')
      .addSelect('o.name', 'orgName')
      .addSelect('ST_AsGeoJSON(b.location)', 'locationGeojson')
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(*)')
            .from('facilities', 'f')
            .where('f.barracks_id = b.id'),
        'facilityCount',
      )
      .orderBy('b.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);

    // Điều kiện dùng chung cho cả truy vấn dữ liệu và đếm tổng.
    const countQb = this.repo.createQueryBuilder('b');
    if (search) {
      qb.andWhere('(b.code ILIKE :s OR b.name ILIKE :s)', { s: `%${search}%` });
      countQb.andWhere('(b.code ILIKE :s OR b.name ILIKE :s)', { s: `%${search}%` });
    }
    if (scope) {
      // Giới hạn theo địa bàn (area scopes) hoặc đơn vị quản lý của người dùng.
      const cond = '(b.area_id = ANY(:areaIds::uuid[]) OR b.organization_id = :orgId)';
      const params = { areaIds: scope.areaIds, orgId: scope.organizationId };
      qb.andWhere(cond, params);
      countQb.andWhere(cond, params);
    }

    const rows = await qb.getRawMany();
    const total = await countQb.getCount();

    const data = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      workflowStatus: r.workflowStatus,
      declaredCapacity: Number(r.declaredCapacity),
      landArea: Number(r.landArea),
      address: r.address,
      updatedAt: r.updatedAt,
      areaName: r.areaName,
      orgName: r.orgName,
      facilityCount: Number(r.facilityCount),
      location: r.locationGeojson ? JSON.parse(r.locationGeojson) : null,
    }));
    return paginated(data, total, q);
  }

  async get(
    id: string,
  ): Promise<Barracks & { location: unknown; areaName: string | null; orgName: string | null }> {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('DATA-001: Không tìm thấy doanh trại');
    // Chuẩn hoá toạ độ về GeoJSON + tên xã/đơn vị để frontend dùng trực tiếp.
    const rows = await this.repo.query(
      `SELECT ST_AsGeoJSON(b.location) AS g, a.name AS area_name, o.name AS org_name
       FROM barracks b
       LEFT JOIN administrative_areas a ON a.id = b.area_id
       LEFT JOIN organizations o ON o.id = b.organization_id
       WHERE b.id = $1`,
      [id],
    );
    const r = rows?.[0] ?? {};
    return {
      ...found,
      location: r.g ? JSON.parse(r.g) : null,
      areaName: r.area_name ?? null,
      orgName: r.org_name ?? null,
    };
  }

  async create(dto: CreateBarracksDto, user: AuthUser): Promise<Barracks> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã doanh trại ${dto.code}`);

    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      areaId: dto.areaId ?? null,
      organizationId: dto.organizationId ?? user.organizationId ?? null,
      declaredCapacity: dto.declaredCapacity ?? 0,
      address: dto.address ?? null,
      landArea: (dto.landArea ?? 0).toString(),
      function: dto.function ?? null,
      location: dto.location ?? null,
      workflowStatus: WorkflowStatus.DRAFT,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    dto: UpdateBarracksDto,
    user: AuthUser,
  ): Promise<Barracks> {
    const b = await this.get(id);
    // Không cho sửa trực tiếp bản đã chốt/khóa (No silent overwrite).
    assertEditable(b.workflowStatus);
    if (dto.name !== undefined) b.name = dto.name;
    if (dto.areaId !== undefined) b.areaId = dto.areaId;
    if (dto.organizationId !== undefined) b.organizationId = dto.organizationId;
    if (dto.declaredCapacity !== undefined) b.declaredCapacity = dto.declaredCapacity;
    if (dto.address !== undefined) b.address = dto.address;
    if (dto.landArea !== undefined) b.landArea = dto.landArea.toString();
    if (dto.function !== undefined) b.function = dto.function;
    if (dto.location !== undefined) b.location = dto.location;
    b.updatedBy = user.sub;
    return this.repo.save(b);
  }

  // UC-05: gửi duyệt — DRAFT/CHANGES_REQUESTED → PENDING_REVIEW, chụp revision.
  async submit(id: string, user: AuthUser): Promise<Barracks> {
    const b = await this.get(id);
    assertEditable(b.workflowStatus, 'gửi duyệt');
    return this.transition(b, WorkflowStatus.PENDING_REVIEW, user);
  }

  // UC-06: phê duyệt — PENDING_REVIEW → APPROVED. Người lập không tự duyệt.
  async approve(id: string, user: AuthUser): Promise<Barracks> {
    const b = await this.get(id);
    assertPendingReview(b.workflowStatus);
    assertNotSelfApprove(b.createdBy, user.sub);
    return this.transition(b, WorkflowStatus.APPROVED, user);
  }

  // UC-06: yêu cầu bổ sung — PENDING_REVIEW → CHANGES_REQUESTED.
  async requestChanges(
    id: string,
    _dto: ReviewDecisionDto,
    user: AuthUser,
  ): Promise<Barracks> {
    const b = await this.get(id);
    assertPendingReview(b.workflowStatus, 'yêu cầu bổ sung');
    return this.transition(b, WorkflowStatus.CHANGES_REQUESTED, user);
  }

  async listRevisions(id: string): Promise<BarracksRevision[]> {
    await this.get(id);
    return this.revisions.find({
      where: { barracksId: id },
      order: { revisionNo: 'DESC' },
    });
  }

  // Chuyển trạng thái + tạo revision bất biến (helper dùng chung workflow-transition).
  private async transition(
    b: Barracks,
    to: WorkflowStatus,
    user: AuthUser,
  ): Promise<Barracks> {
    return transitionWithRevision(
      {
        dataSource: this.dataSource,
        entityTarget: Barracks,
        revisionTarget: BarracksRevision,
        fkColumn: 'barracksId',
        buildPayload: (saved) => ({
          code: saved.code,
          name: saved.name,
          areaId: saved.areaId,
          organizationId: saved.organizationId,
          declaredCapacity: saved.declaredCapacity,
        }),
      },
      b,
      to,
      user.sub,
    );
  }
}
