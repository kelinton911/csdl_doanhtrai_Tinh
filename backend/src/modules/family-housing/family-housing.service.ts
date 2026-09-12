import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyHousingArea } from './entities/family-housing-area.entity';
import {
  CreateFamilyHousingDto,
  UpdateFamilyHousingDto,
} from './dto/family-housing.dto';
import { WorkflowStatus } from '../../common/workflow';
import {
  assertEditable,
  assertNotSelfApprove,
  assertPendingReview,
} from '../../common/workflow-transition';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface FamilyHousingFilters {
  search?: string;
  workflowStatus?: string;
  areaId?: string;
}

// Biểu 01/KK-KGĐ — Khu gia đình quân đội đang QL, chưa bàn giao. CRUD + workflow duyệt nhẹ.
@Injectable()
export class FamilyHousingService {
  constructor(
    @InjectRepository(FamilyHousingArea) private readonly repo: Repository<FamilyHousingArea>,
  ) {}

  async list(q: PaginationQuery, filters: FamilyHousingFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('h')
      .leftJoin('administrative_areas', 'a', 'a.id = h.area_id')
      .leftJoin('organizations', 'o', 'o.id = h.organization_id')
      .select('h.id', 'id')
      .addSelect('h.code', 'code')
      .addSelect('h.name', 'name')
      .addSelect('h.total_area', 'totalArea')
      .addSelect('h.household_count', 'householdCount')
      .addSelect('h.address', 'address')
      .addSelect('h.planned_handover', 'plannedHandover')
      .addSelect('h.workflow_status', 'workflowStatus')
      .addSelect('h.updated_at', 'updatedAt')
      .addSelect('a.name', 'areaName')
      .addSelect('o.name', 'orgName')
      .orderBy('h.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);

    const countQb = this.repo.createQueryBuilder('h');
    const applyFilters = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(h.code ILIKE :s OR h.name ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.workflowStatus) b.andWhere('h.workflow_status = :ws', { ws: filters.workflowStatus });
      if (filters.areaId) b.andWhere('h.area_id = :aid', { aid: filters.areaId });
      // Phạm vi (SYS-BR-08): cấp xã/đơn vị chỉ thấy khu gia đình trong địa bàn/đơn vị mình.
      if (scope) {
        b.andWhere('(h.area_id = ANY(:scAreaIds::uuid[]) OR h.organization_id = :scOrgId)', {
          scAreaIds: scope.areaIds,
          scOrgId: scope.organizationId,
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
      totalArea: Number(r.totalArea),
      householdCount: Number(r.householdCount),
      address: r.address,
      plannedHandover: r.plannedHandover,
      workflowStatus: r.workflowStatus,
      updatedAt: r.updatedAt,
      areaName: r.areaName,
      orgName: r.orgName,
    }));
    return paginated(data, total, q);
  }

  async get(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException('DATA-001: Không tìm thấy khu gia đình');
    return found;
  }

  async create(dto: CreateFamilyHousingDto, user: AuthUser): Promise<FamilyHousingArea> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã khu gia đình ${dto.code}`);
    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      organizationId: dto.organizationId ?? user.organizationId ?? null,
      areaId: dto.areaId ?? null,
      address: dto.address ?? null,
      totalArea: (dto.totalArea ?? 0).toString(),
      householdCount: dto.householdCount ?? 0,
      legalDoc: dto.legalDoc ?? null,
      notHandedReason: dto.notHandedReason ?? null,
      plannedHandover: dto.plannedHandover ?? null,
      note: dto.note ?? null,
      dataSource: dto.dataSource ?? null,
      workflowStatus: WorkflowStatus.DRAFT,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateFamilyHousingDto, user: AuthUser): Promise<FamilyHousingArea> {
    const h = await this.repo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('DATA-001: Không tìm thấy khu gia đình');
    assertEditable(h.workflowStatus);
    const assign = <K extends keyof FamilyHousingArea>(k: K, v: FamilyHousingArea[K] | undefined) => {
      if (v !== undefined) h[k] = v;
    };
    assign('name', dto.name);
    assign('organizationId', dto.organizationId ?? undefined);
    assign('areaId', dto.areaId ?? undefined);
    assign('address', dto.address ?? undefined);
    if (dto.totalArea !== undefined) h.totalArea = dto.totalArea.toString();
    assign('householdCount', dto.householdCount);
    assign('legalDoc', dto.legalDoc ?? undefined);
    assign('notHandedReason', dto.notHandedReason ?? undefined);
    assign('plannedHandover', dto.plannedHandover ?? undefined);
    assign('note', dto.note ?? undefined);
    assign('dataSource', dto.dataSource ?? undefined);
    h.updatedBy = user.sub;
    return this.repo.save(h);
  }

  async submit(id: string, user: AuthUser): Promise<FamilyHousingArea> {
    const h = await this.repo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('DATA-001: Không tìm thấy khu gia đình');
    assertEditable(h.workflowStatus, 'gửi duyệt');
    h.workflowStatus = WorkflowStatus.PENDING_REVIEW;
    h.updatedBy = user.sub;
    return this.repo.save(h);
  }

  async approve(id: string, user: AuthUser): Promise<FamilyHousingArea> {
    const h = await this.repo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('DATA-001: Không tìm thấy khu gia đình');
    assertPendingReview(h.workflowStatus);
    assertNotSelfApprove(h.createdBy, user.sub);
    h.workflowStatus = WorkflowStatus.APPROVED;
    h.updatedBy = user.sub;
    return this.repo.save(h);
  }

  async requestChanges(id: string, user: AuthUser): Promise<FamilyHousingArea> {
    const h = await this.repo.findOne({ where: { id } });
    if (!h) throw new NotFoundException('DATA-001: Không tìm thấy khu gia đình');
    assertPendingReview(h.workflowStatus, 'yêu cầu bổ sung');
    h.workflowStatus = WorkflowStatus.CHANGES_REQUESTED;
    h.updatedBy = user.sub;
    return this.repo.save(h);
  }
}
