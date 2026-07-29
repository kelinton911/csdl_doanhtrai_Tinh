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

// M09 — Maintenance & Recovery. UC-13 (hư hỏng), UC-14 (yêu cầu sửa chữa).
@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(DamageEvent) private readonly damages: Repository<DamageEvent>,
    @InjectRepository(MaintenanceRequest) private readonly requests: Repository<MaintenanceRequest>,
  ) {}

  // ------- Hư hỏng (UC-13) -------
  async listDamages(q: PaginationQuery, filters: { entityId?: string; status?: string }) {
    const where: Record<string, string> = {};
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.status) where.status = filters.status;
    const [data, total] = await this.damages.findAndCount({ where, order: { occurredAt: 'DESC' }, skip: q.skip, take: q.size });
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
  async listRequests(q: PaginationQuery, filters: { status?: string; barracksId?: string }) {
    const where: Record<string, string> = {};
    if (filters.status) where.status = filters.status;
    if (filters.barracksId) where.barracksId = filters.barracksId;
    const [data, total] = await this.requests.findAndCount({ where, order: { createdAt: 'DESC' }, skip: q.skip, take: q.size });
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
