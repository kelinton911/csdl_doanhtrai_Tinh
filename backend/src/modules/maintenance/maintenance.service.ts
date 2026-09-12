import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DamageEvent } from './entities/damage-event.entity';
import { MaintenanceRequest } from './entities/maintenance-request.entity';
import {
  AcceptDto,
  CreateDamageEventDto,
  CreateMaintenanceRequestDto,
  StartDto,
  UpdateDamageEventDto,
} from './dto/maintenance.dto';
import { MaintenanceStatus } from '../../common/workflow';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

// Điều kiện lọc phạm vi: bản ghi gắn với doanh trại trong địa bàn/đơn vị của người dùng.
// Trả về mệnh đề SQL con tham chiếu cột doanh trại (barracksCol) / công trình (facilityCol).
const COMMUNE_BARRACKS = `SELECT id FROM barracks b_s WHERE b_s.area_id = ANY(:scAreaIds::uuid[]) OR b_s.organization_id = :scOrgId`;
const COMMUNE_FACILITIES = `SELECT f_s.id FROM facilities f_s JOIN barracks b_f ON b_f.id = f_s.barracks_id WHERE b_f.area_id = ANY(:scAreaIds::uuid[]) OR b_f.organization_id = :scOrgId`;

// M09 — Maintenance & Recovery. UC-13 (hư hỏng), UC-14 (yêu cầu sửa chữa).
@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(DamageEvent) private readonly damages: Repository<DamageEvent>,
    @InjectRepository(MaintenanceRequest) private readonly requests: Repository<MaintenanceRequest>,
  ) {}

  // ------- Hư hỏng (UC-13) -------
  async listDamages(
    q: PaginationQuery,
    filters: { entityId?: string; status?: string },
    user?: AuthUser,
  ) {
    const qb = this.damages
      .createQueryBuilder('d')
      .orderBy('d.occurredAt', 'DESC')
      .skip(q.skip)
      .take(q.size);
    if (filters.entityId) qb.andWhere('d.entity_id = :eid', { eid: filters.entityId });
    if (filters.status) qb.andWhere('d.status = :st', { st: filters.status });
    // Phạm vi (SYS-BR-08): chỉ hư hỏng của doanh trại/công trình trong địa bàn/đơn vị mình.
    const scope = barracksScope(user);
    if (scope) {
      qb.andWhere(
        `((d.entity_type = 'barracks' AND d.entity_id IN (${COMMUNE_BARRACKS}))
          OR (d.entity_type = 'facility' AND d.entity_id IN (${COMMUNE_FACILITIES})))`,
        { scAreaIds: scope.areaIds, scOrgId: scope.organizationId },
      );
    }
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async createDamage(dto: CreateDamageEventDto, user: AuthUser) {
    return this.damages.save(
      this.damages.create({
        entityType: dto.entityType,
        entityId: dto.entityId,
        causeCode: dto.causeCode ?? null,
        severity: dto.severity ?? 'MEDIUM',
        description: dto.description ?? null,
        estimatedLoss: String(dto.estimatedLoss ?? 0),
        scenario: dto.scenario ?? false,
        status: 'REPORTED',
        reportedBy: user.sub,
      }),
    );
  }

  async updateDamage(id: string, dto: UpdateDamageEventDto) {
    const d = await this.damages.findOne({ where: { id } });
    if (!d) throw new NotFoundException('DATA-001: Không tìm thấy sự kiện hư hỏng');
    if (d.status === 'VERIFIED') throw new ConflictException('WF-001: Sự kiện đã xác minh, không sửa trực tiếp');
    if (dto.causeCode !== undefined) d.causeCode = dto.causeCode;
    if (dto.severity !== undefined) d.severity = dto.severity;
    if (dto.description !== undefined) d.description = dto.description;
    if (dto.estimatedLoss !== undefined) d.estimatedLoss = String(dto.estimatedLoss);
    return this.damages.save(d);
  }

  async verifyDamage(id: string, user: AuthUser) {
    const d = await this.damages.findOne({ where: { id } });
    if (!d) throw new NotFoundException('DATA-001: Không tìm thấy sự kiện hư hỏng');
    if (d.status === 'VERIFIED') throw new ConflictException('WF-001: Sự kiện đã xác minh');
    d.status = 'VERIFIED';
    d.verifiedBy = user.sub;
    d.verifiedAt = new Date();
    return this.damages.save(d);
  }

  // ------- Yêu cầu sửa chữa (UC-14) -------
  async listRequests(
    q: PaginationQuery,
    filters: { status?: string; barracksId?: string },
    user?: AuthUser,
  ) {
    const qb = this.requests
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC')
      .skip(q.skip)
      .take(q.size);
    if (filters.status) qb.andWhere('r.status = :st', { st: filters.status });
    if (filters.barracksId) qb.andWhere('r.barracks_id = :bid', { bid: filters.barracksId });
    // Phạm vi (SYS-BR-08): chỉ yêu cầu gắn doanh trại/công trình trong địa bàn/đơn vị mình.
    const scope = barracksScope(user);
    if (scope) {
      qb.andWhere(
        `(r.barracks_id IN (${COMMUNE_BARRACKS}) OR r.facility_id IN (${COMMUNE_FACILITIES}))`,
        { scAreaIds: scope.areaIds, scOrgId: scope.organizationId },
      );
    }
    const [data, total] = await qb.getManyAndCount();
    return paginated(data, total, q);
  }

  async getRequest(id: string) {
    const r = await this.requests.findOne({ where: { id } });
    if (!r) throw new NotFoundException('DATA-001: Không tìm thấy yêu cầu sửa chữa');
    return r;
  }

  async createRequest(dto: CreateMaintenanceRequestDto, user: AuthUser) {
    const dup = await this.requests.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã yêu cầu ${dto.code}`);
    return this.requests.save(
      this.requests.create({
        code: dto.code,
        title: dto.title,
        barracksId: dto.barracksId ?? null,
        facilityId: dto.facilityId ?? null,
        damageEventId: dto.damageEventId ?? null,
        scope: dto.scope ?? null,
        priority: dto.priority ?? 'NORMAL',
        estimatedCost: String(dto.estimatedCost ?? 0),
        plannedDays: dto.plannedDays ?? 0,
        assigneeName: dto.assigneeName ?? null,
        status: MaintenanceStatus.DRAFT,
        createdBy: user.sub,
      }),
    );
  }

  async submit(id: string) {
    return this.transition(id, [MaintenanceStatus.DRAFT], MaintenanceStatus.PROPOSED, null);
  }

  async approve(id: string, user: AuthUser) {
    const r = await this.getRequest(id);
    if (r.status !== MaintenanceStatus.PROPOSED) {
      throw new ConflictException('WF-001: Chỉ duyệt yêu cầu đang PROPOSED');
    }
    if (r.createdBy && r.createdBy === user.sub) {
      throw new ForbiddenException('AUTH-003: Người lập không được tự duyệt yêu cầu');
    }
    r.status = MaintenanceStatus.APPROVED;
    r.approvedBy = user.sub;
    return this.requests.save(r);
  }

  async start(id: string, dto?: StartDto) {
    const r = await this.getRequest(id);
    if (r.status !== MaintenanceStatus.APPROVED) {
      throw new ConflictException(`WF-001: Trạng thái ${r.status} không cho phép bắt đầu thực hiện`);
    }
    if (dto?.assigneeName !== undefined) r.assigneeName = dto.assigneeName;
    r.status = MaintenanceStatus.IN_PROGRESS;
    return this.requests.save(r);
  }

  async accept(id: string, dto: AcceptDto) {
    const r = await this.getRequest(id);
    if (r.status !== MaintenanceStatus.IN_PROGRESS) {
      throw new ConflictException('WF-001: Chỉ nghiệm thu yêu cầu đang IN_PROGRESS');
    }
    r.status = MaintenanceStatus.ACCEPTED;
    r.acceptanceNote = dto.note ?? null;
    r.acceptedAt = new Date();
    return this.requests.save(r);
  }

  async close(id: string) {
    return this.transition(id, [MaintenanceStatus.ACCEPTED], MaintenanceStatus.CLOSED, null);
  }

  private async transition(
    id: string,
    from: MaintenanceStatus[],
    to: MaintenanceStatus,
    _extra: unknown,
  ) {
    const r = await this.getRequest(id);
    if (!from.includes(r.status)) {
      throw new ConflictException(`WF-001: Trạng thái ${r.status} không cho phép chuyển sang ${to}`);
    }
    r.status = to;
    return this.requests.save(r);
  }
}
