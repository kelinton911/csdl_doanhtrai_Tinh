import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Inspection } from './entities/inspection.entity';
import { InspectionFinding } from './entities/inspection-finding.entity';
import {
  CreateFindingDto,
  CreateInspectionDto,
  ResolveFindingDto,
  UpdateFindingDto,
  UpdateInspectionDto,
} from './dto/oversight.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface InspectionFilters {
  search?: string;
  status?: string;
  inspectionType?: string;
}
const PHASES = ['PLANNED', 'IN_PROGRESS', 'REPORTED', 'CLOSED'];
const FINDING_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'ACCEPTED'];

// M22 — Kiểm tra, thanh tra & xử lý kiến nghị. Cuộc kiểm tra (vòng đời) + phát hiện/kiến nghị
// (theo dõi khắc phục). Không xóa cứng cuộc kiểm tra (CANCELLED).
@Injectable()
export class OversightService {
  constructor(
    @InjectRepository(Inspection) private readonly repo: Repository<Inspection>,
    @InjectRepository(InspectionFinding) private readonly findings: Repository<InspectionFinding>,
    private readonly ds: DataSource,
  ) {}

  async list(q: PaginationQuery, filters: InspectionFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('i')
      .leftJoin('organizations', 'o', 'o.id = i.target_org_id')
      .leftJoin('administrative_areas', 'a', 'a.id = i.target_area_id')
      .leftJoin('barracks', 'b', 'b.id = i.target_barracks_id')
      .select('i.id', 'id').addSelect('i.code', 'code').addSelect('i.title', 'title')
      .addSelect('i.inspection_type', 'inspectionType').addSelect('i.status', 'status')
      .addSelect('i.planned_date', 'plannedDate').addSelect('i.end_date', 'endDate').addSelect('i.updated_at', 'updatedAt')
      .addSelect('COALESCE(o.name, b.name, a.name)', 'targetName')
      .addSelect((sub) => sub.select('COUNT(*)').from('inspection_findings', 'f').where('f.inspection_id = i.id'), 'findingCount')
      .addSelect((sub) => sub.select('COUNT(*)').from('inspection_findings', 'f').where("f.inspection_id = i.id AND f.status NOT IN ('RESOLVED','ACCEPTED')"), 'openFindingCount')
      .orderBy('i.code', 'DESC').offset(q.skip).limit(q.size);

    const countQb = this.repo.createQueryBuilder('i');
    const apply = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(i.code ILIKE :s OR i.title ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.status) b.andWhere('i.status = :st', { st: filters.status });
      if (filters.inspectionType) b.andWhere('i.inspection_type = :it', { it: filters.inspectionType });
      // Data-scope tầng service: giới hạn theo địa bàn/đơn vị mục tiêu của cuộc kiểm tra;
      // null = xem toàn tỉnh (AUDITOR/PROVINCIAL_COMMAND…).
      if (scope) {
        b.andWhere('(i.target_area_id = ANY(:areaIds::uuid[]) OR i.target_org_id = :orgId)', {
          areaIds: scope.areaIds,
          orgId: scope.organizationId,
        });
      }
    };
    apply(qb);
    apply(countQb);

    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    return paginated(
      rows.map((r) => ({
        id: r.id, code: r.code, title: r.title, inspectionType: r.inspectionType, status: r.status,
        plannedDate: r.plannedDate, endDate: r.endDate, updatedAt: r.updatedAt, targetName: r.targetName,
        findingCount: Number(r.findingCount), openFindingCount: Number(r.openFindingCount),
      })),
      total,
      q,
    );
  }

  async get(id: string) {
    const insp = await this.repo.findOne({ where: { id } });
    if (!insp) throw new NotFoundException('DATA-001: Không tìm thấy cuộc kiểm tra');
    const [meta] = await this.ds.query(
      `SELECT o.name AS org, a.name AS area, b.name AS barracks FROM inspections i
       LEFT JOIN organizations o ON o.id = i.target_org_id
       LEFT JOIN administrative_areas a ON a.id = i.target_area_id
       LEFT JOIN barracks b ON b.id = i.target_barracks_id WHERE i.id = $1`,
      [id],
    );
    const findings = await this.ds.query(
      `SELECT f.id, f.title, f.severity, f.recommendation, f.due_date AS "dueDate", f.status,
              f.resolution_note AS "resolutionNote", f.resolved_at AS "resolvedAt",
              o.name AS "responsibleOrgName", a.name AS "responsibleAreaName"
       FROM inspection_findings f
       LEFT JOIN organizations o ON o.id = f.responsible_org_id
       LEFT JOIN administrative_areas a ON a.id = f.responsible_area_id
       WHERE f.inspection_id = $1 ORDER BY
         CASE f.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, f.created_at ASC`,
      [id],
    );
    return {
      ...insp,
      targetOrgName: meta?.org ?? null,
      targetAreaName: meta?.area ?? null,
      targetBarracksName: meta?.barracks ?? null,
      findings,
    };
  }

  async create(dto: CreateInspectionDto, user: AuthUser): Promise<Inspection> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã cuộc kiểm tra ${dto.code}`);
    return this.repo.save(this.repo.create({
      code: dto.code, title: dto.title, inspectionType: dto.inspectionType ?? 'PERIODIC',
      scope: dto.scope ?? null, targetOrgId: dto.targetOrgId ?? null, targetAreaId: dto.targetAreaId ?? null,
      targetBarracksId: dto.targetBarracksId ?? null, leadName: dto.leadName ?? null, teamNote: dto.teamNote ?? null,
      plannedDate: dto.plannedDate ?? null, startDate: dto.startDate ?? null, endDate: dto.endDate ?? null,
      status: 'PLANNED', createdBy: user.sub, updatedBy: user.sub,
    }));
  }

  async update(id: string, dto: UpdateInspectionDto, user: AuthUser): Promise<Inspection> {
    const i = await this.repo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('DATA-001: Không tìm thấy cuộc kiểm tra');
    if (['CLOSED', 'CANCELLED'].includes(i.status)) throw new ConflictException(`WF-001: Cuộc kiểm tra đã ${i.status}, không thể sửa`);
    Object.assign(i, {
      title: dto.title ?? i.title,
      inspectionType: dto.inspectionType ?? i.inspectionType,
      scope: dto.scope !== undefined ? dto.scope || null : i.scope,
      targetOrgId: dto.targetOrgId !== undefined ? dto.targetOrgId || null : i.targetOrgId,
      targetAreaId: dto.targetAreaId !== undefined ? dto.targetAreaId || null : i.targetAreaId,
      targetBarracksId: dto.targetBarracksId !== undefined ? dto.targetBarracksId || null : i.targetBarracksId,
      leadName: dto.leadName !== undefined ? dto.leadName || null : i.leadName,
      teamNote: dto.teamNote !== undefined ? dto.teamNote || null : i.teamNote,
      plannedDate: dto.plannedDate !== undefined ? dto.plannedDate || null : i.plannedDate,
      startDate: dto.startDate !== undefined ? dto.startDate || null : i.startDate,
      endDate: dto.endDate !== undefined ? dto.endDate || null : i.endDate,
      conclusion: dto.conclusion !== undefined ? dto.conclusion || null : i.conclusion,
      updatedBy: user.sub,
    });
    return this.repo.save(i);
  }

  async setStatus(id: string, status: string, conclusion: string | undefined, user: AuthUser): Promise<Inspection> {
    const i = await this.repo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('DATA-001: Không tìm thấy cuộc kiểm tra');
    if (['CLOSED', 'CANCELLED'].includes(i.status)) throw new ConflictException(`WF-001: Cuộc kiểm tra đã ${i.status}`);
    if (status === 'CANCELLED') { i.status = 'CANCELLED'; i.updatedBy = user.sub; return this.repo.save(i); }
    const from = PHASES.indexOf(i.status);
    const to = PHASES.indexOf(status);
    if (to < 0) throw new BadRequestException('VAL-001: Trạng thái không hợp lệ');
    if (to <= from) throw new ConflictException('WF-001: Chỉ chuyển tới trạng thái sau');
    i.status = status;
    if (status === 'IN_PROGRESS' && !i.startDate) i.startDate = new Date().toISOString().slice(0, 10);
    if ((status === 'REPORTED' || status === 'CLOSED') && !i.endDate) i.endDate = new Date().toISOString().slice(0, 10);
    if (conclusion !== undefined) i.conclusion = conclusion || i.conclusion;
    i.updatedBy = user.sub;
    return this.repo.save(i);
  }

  // ── Phát hiện & kiến nghị ────────────────────────────────────
  async addFinding(inspectionId: string, dto: CreateFindingDto, user: AuthUser) {
    const i = await this.repo.findOne({ where: { id: inspectionId } });
    if (!i) throw new NotFoundException('DATA-001: Không tìm thấy cuộc kiểm tra');
    if (i.status === 'CANCELLED') throw new ConflictException('WF-001: Cuộc kiểm tra đã hủy');
    return this.findings.save(this.findings.create({
      inspectionId, title: dto.title, severity: dto.severity ?? 'MEDIUM', recommendation: dto.recommendation ?? null,
      responsibleOrgId: dto.responsibleOrgId ?? null, responsibleAreaId: dto.responsibleAreaId ?? null,
      dueDate: dto.dueDate ?? null, status: 'OPEN',
      linkedEntityType: dto.linkedEntityType ?? null, linkedEntityId: dto.linkedEntityId ?? null,
      createdBy: user.sub,
    }));
  }

  async updateFinding(inspectionId: string, findingId: string, dto: UpdateFindingDto) {
    const f = await this.findings.findOne({ where: { id: findingId, inspectionId } });
    if (!f) throw new NotFoundException('DATA-001: Không tìm thấy phát hiện');
    Object.assign(f, {
      title: dto.title ?? f.title, severity: dto.severity ?? f.severity,
      recommendation: dto.recommendation !== undefined ? dto.recommendation || null : f.recommendation,
      responsibleOrgId: dto.responsibleOrgId !== undefined ? dto.responsibleOrgId || null : f.responsibleOrgId,
      responsibleAreaId: dto.responsibleAreaId !== undefined ? dto.responsibleAreaId || null : f.responsibleAreaId,
      dueDate: dto.dueDate !== undefined ? dto.dueDate || null : f.dueDate,
    });
    return this.findings.save(f);
  }

  async setFindingStatus(inspectionId: string, findingId: string, status: string, dto: ResolveFindingDto) {
    if (!FINDING_STATUSES.includes(status)) throw new BadRequestException('VAL-001: Trạng thái phát hiện không hợp lệ');
    const f = await this.findings.findOne({ where: { id: findingId, inspectionId } });
    if (!f) throw new NotFoundException('DATA-001: Không tìm thấy phát hiện');
    f.status = status;
    if (status === 'RESOLVED' || status === 'ACCEPTED') {
      if (dto.resolutionNote) f.resolutionNote = dto.resolutionNote;
      if (!f.resolvedAt) f.resolvedAt = new Date();
    }
    if (status === 'OPEN' || status === 'IN_PROGRESS') f.resolvedAt = null;
    return this.findings.save(f);
  }

  async removeFinding(inspectionId: string, findingId: string) {
    const f = await this.findings.findOne({ where: { id: findingId, inspectionId } });
    if (!f) throw new NotFoundException('DATA-001: Không tìm thấy phát hiện');
    await this.findings.remove(f);
    return { deleted: true };
  }

  async summary() {
    const [insp] = await this.ds.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
              COUNT(*) FILTER (WHERE status = 'PLANNED')::int AS planned
       FROM inspections`,
    );
    const [find] = await this.ds.query(
      `SELECT COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','ACCEPTED'))::int AS open,
              COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','ACCEPTED') AND due_date IS NOT NULL AND due_date < now())::int AS overdue
       FROM inspection_findings`,
    );
    return {
      generatedAt: new Date().toISOString(),
      total: Number(insp.total), inProgress: Number(insp.in_progress), planned: Number(insp.planned),
      openFindings: Number(find.open), overdueFindings: Number(find.overdue),
    };
  }
}
