import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectMilestone } from './entities/project-milestone.entity';
import { Facility } from '../facilities/entities/facility.entity';
import { FacilityStatus } from '../facilities/facility-status';
import {
  CreateMilestoneDto,
  CreateProjectDto,
  PROJECT_PHASES,
  UpdateProjectDto,
} from './dto/project.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface ProjectFilters {
  search?: string;
  phase?: string;
  projectType?: string;
  fundingSource?: string;
  barracksId?: string;
}
const TERMINAL = ['CLOSED', 'CANCELLED'];

// M13 — Xây dựng cơ bản / dự án đầu tư. CRUD + vòng đời phase (tiến về sau, hoàn thành sinh
// tài sản) + nhật ký tiến độ/giải ngân (milestones). Không xóa cứng (phase CANCELLED).
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly repo: Repository<Project>,
    @InjectRepository(ProjectMilestone) private readonly milestones: Repository<ProjectMilestone>,
    @InjectRepository(Facility) private readonly facilities: Repository<Facility>,
    private readonly ds: DataSource,
  ) {}

  async list(q: PaginationQuery, filters: ProjectFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('p')
      .leftJoin('barracks', 'b', 'b.id = p.barracks_id')
      .leftJoin('administrative_areas', 'a', 'a.id = p.area_id')
      .select('p.id', 'id')
      .addSelect('p.code', 'code')
      .addSelect('p.name', 'name')
      .addSelect('p.project_type', 'projectType')
      .addSelect('p.funding_source', 'fundingSource')
      .addSelect('p.total_estimate', 'totalEstimate')
      .addSelect('p.approved_capital', 'approvedCapital')
      .addSelect('p.progress_percent', 'progressPercent')
      .addSelect('p.phase', 'phase')
      .addSelect('p.planned_end_date', 'plannedEndDate')
      .addSelect('p.updated_at', 'updatedAt')
      .addSelect('b.name', 'barracksName')
      .addSelect('a.name', 'areaName')
      .addSelect(
        (sub) => sub.select("COALESCE(SUM(m.amount),0)").from('project_milestones', 'm').where("m.project_id = p.id AND m.kind = 'PAYMENT'"),
        'disbursed',
      )
      .orderBy('p.code', 'DESC')
      .offset(q.skip)
      .limit(q.size);

    const countQb = this.repo.createQueryBuilder('p');
    const apply = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(p.code ILIKE :s OR p.name ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.phase) b.andWhere('p.phase = :ph', { ph: filters.phase });
      if (filters.projectType) b.andWhere('p.project_type = :pt', { pt: filters.projectType });
      if (filters.fundingSource) b.andWhere('p.funding_source = :fs', { fs: filters.fundingSource });
      if (filters.barracksId) b.andWhere('p.barracks_id = :bid', { bid: filters.barracksId });
      if (scope) b.andWhere('(p.area_id = ANY(:areaIds::uuid[]) OR p.organization_id = :orgId)', { areaIds: scope.areaIds, orgId: scope.organizationId });
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
        projectType: r.projectType,
        fundingSource: r.fundingSource,
        totalEstimate: Number(r.totalEstimate),
        approvedCapital: Number(r.approvedCapital),
        disbursed: Number(r.disbursed),
        progressPercent: Number(r.progressPercent),
        phase: r.phase,
        plannedEndDate: r.plannedEndDate,
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
    if (!found) throw new NotFoundException('DATA-001: Không tìm thấy dự án');
    const rows = await this.repo.query(
      `SELECT ST_AsGeoJSON(p.location) AS loc, b.name AS barracks_name, a.name AS area_name, o.name AS org_name,
              (SELECT COALESCE(SUM(m.amount),0) FROM project_milestones m WHERE m.project_id = p.id AND m.kind='PAYMENT') AS disbursed
       FROM projects p
       LEFT JOIN barracks b ON b.id = p.barracks_id
       LEFT JOIN administrative_areas a ON a.id = p.area_id
       LEFT JOIN organizations o ON o.id = p.organization_id
       WHERE p.id = $1`,
      [id],
    );
    const r = rows?.[0] ?? {};
    return {
      ...found,
      location: r.loc ? JSON.parse(r.loc) : null,
      barracksName: r.barracks_name ?? null,
      areaName: r.area_name ?? null,
      orgName: r.org_name ?? null,
      disbursed: Number(r.disbursed ?? 0),
    };
  }

  async create(dto: CreateProjectDto, user: AuthUser): Promise<Project> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã dự án ${dto.code}`);
    const entity = this.repo.create({
      code: dto.code,
      name: dto.name,
      projectType: dto.projectType,
      barracksId: dto.barracksId ?? null,
      areaId: dto.areaId ?? null,
      organizationId: dto.organizationId ?? user.organizationId ?? null,
      fundingSource: dto.fundingSource ?? null,
      totalEstimate: (dto.totalEstimate ?? 0).toString(),
      approvedCapital: (dto.approvedCapital ?? 0).toString(),
      contractorName: dto.contractorName ?? null,
      contractNo: dto.contractNo ?? null,
      contractValue: (dto.contractValue ?? 0).toString(),
      contractSignedDate: dto.contractSignedDate ?? null,
      startDate: dto.startDate ?? null,
      plannedEndDate: dto.plannedEndDate ?? null,
      actualEndDate: dto.actualEndDate ?? null,
      progressPercent: dto.progressPercent ?? 0,
      phase: 'PROPOSAL',
      description: dto.description ?? null,
      notes: dto.notes ?? null,
      location: dto.location ?? null,
      createdBy: user.sub,
      updatedBy: user.sub,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthUser): Promise<Project> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự án');
    if (TERMINAL.includes(p.phase)) throw new ConflictException(`WF-001: Dự án ở giai đoạn ${p.phase}, không thể sửa`);
    const num = (k: 'totalEstimate' | 'approvedCapital' | 'contractValue', v?: number) => { if (v !== undefined) p[k] = v.toString(); };
    if (dto.name !== undefined) p.name = dto.name;
    if (dto.projectType !== undefined) p.projectType = dto.projectType;
    if (dto.barracksId !== undefined) p.barracksId = dto.barracksId || null;
    if (dto.areaId !== undefined) p.areaId = dto.areaId || null;
    if (dto.organizationId !== undefined) p.organizationId = dto.organizationId || null;
    if (dto.fundingSource !== undefined) p.fundingSource = dto.fundingSource || null;
    num('totalEstimate', dto.totalEstimate);
    num('approvedCapital', dto.approvedCapital);
    num('contractValue', dto.contractValue);
    if (dto.contractorName !== undefined) p.contractorName = dto.contractorName || null;
    if (dto.contractNo !== undefined) p.contractNo = dto.contractNo || null;
    if (dto.contractSignedDate !== undefined) p.contractSignedDate = dto.contractSignedDate || null;
    if (dto.startDate !== undefined) p.startDate = dto.startDate || null;
    if (dto.plannedEndDate !== undefined) p.plannedEndDate = dto.plannedEndDate || null;
    if (dto.actualEndDate !== undefined) p.actualEndDate = dto.actualEndDate || null;
    if (dto.progressPercent !== undefined) p.progressPercent = dto.progressPercent;
    if (dto.description !== undefined) p.description = dto.description || null;
    if (dto.notes !== undefined) p.notes = dto.notes || null;
    if (dto.location !== undefined) p.location = dto.location;
    p.updatedBy = user.sub;
    return this.repo.save(p);
  }

  // Chuyển giai đoạn: chỉ tiến về sau trong PROJECT_PHASES hoặc CANCELLED. Bàn giao (HANDED_OVER)
  // sinh tài sản (facility) trong doanh trại nếu chưa sinh — "hoàn công → tài sản".
  async setPhase(id: string, phase: string, user: AuthUser): Promise<Project> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự án');
    if (TERMINAL.includes(p.phase)) throw new ConflictException(`WF-001: Dự án đã ${p.phase}, không thể chuyển giai đoạn`);
    if (phase === 'CANCELLED') { p.phase = 'CANCELLED'; p.updatedBy = user.sub; return this.repo.save(p); }
    const from = PROJECT_PHASES.indexOf(p.phase as never);
    const to = PROJECT_PHASES.indexOf(phase as never);
    if (to < 0) throw new BadRequestException('VAL-001: Giai đoạn không hợp lệ');
    if (to <= from) throw new ConflictException('WF-001: Chỉ được chuyển tới giai đoạn sau');

    return this.ds.transaction(async (m) => {
      const projRepo = m.getRepository(Project);
      p.phase = phase;
      if (phase === 'HANDED_OVER') {
        if (!p.actualEndDate) p.actualEndDate = new Date().toISOString().slice(0, 10);
        p.progressPercent = 100;
        // Sinh tài sản nếu gắn doanh trại và chưa sinh.
        if (p.barracksId && !p.facilityId) {
          const facRepo = m.getRepository(Facility);
          const code = `CT-${p.code}`;
          const exists = await facRepo.findOne({ where: { barracksId: p.barracksId, code } });
          if (!exists) {
            const year = Number((p.actualEndDate ?? '').slice(0, 4)) || new Date().getFullYear();
            const fac = await facRepo.save(facRepo.create({
              barracksId: p.barracksId,
              code,
              name: p.name,
              type: null,
              area: '0',
              declaredCapacity: 0,
              buildYear: year,
              condition: 'GOOD',
              status: FacilityStatus.IN_USE,
              location: p.location ?? null,
              createdBy: user.sub,
              updatedBy: user.sub,
            }));
            p.facilityId = fac.id;
          } else {
            p.facilityId = exists.id;
          }
        }
      }
      p.updatedBy = user.sub;
      return projRepo.save(p);
    });
  }

  async listMilestones(projectId: string) {
    const rows = await this.milestones.find({ where: { projectId }, order: { milestoneDate: 'DESC' } });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      milestoneDate: r.milestoneDate,
      kind: r.kind,
      progressPercent: r.progressPercent,
      amount: r.amount != null ? Number(r.amount) : null,
      note: r.note,
    }));
  }

  async addMilestone(projectId: string, dto: CreateMilestoneDto, user: AuthUser) {
    const p = await this.repo.findOne({ where: { id: projectId } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự án');
    const saved = await this.milestones.save(this.milestones.create({
      projectId,
      title: dto.title,
      milestoneDate: dto.milestoneDate,
      kind: dto.kind ?? 'PROGRESS',
      progressPercent: dto.progressPercent ?? null,
      amount: dto.amount != null ? dto.amount.toString() : null,
      note: dto.note ?? null,
      createdBy: user.sub,
    }));
    // Mốc tiến độ cập nhật % dự án (không lùi).
    if (saved.kind === 'PROGRESS' && saved.progressPercent != null && saved.progressPercent > p.progressPercent) {
      p.progressPercent = saved.progressPercent;
      p.updatedBy = user.sub;
      await this.repo.save(p);
    }
    return saved;
  }

  async removeMilestone(projectId: string, milestoneId: string) {
    const m = await this.milestones.findOne({ where: { id: milestoneId, projectId } });
    if (!m) throw new NotFoundException('DATA-001: Không tìm thấy mốc');
    await this.milestones.remove(m);
    return { deleted: true };
  }

  // Tổng hợp đầu tư: đếm theo giai đoạn + tổng dự toán/giải ngân + số dự án chậm tiến độ.
  async summary(user?: AuthUser) {
    const scope = barracksScope(user);
    const scopeCond = scope ? `WHERE (area_id = ANY($1::uuid[]) OR organization_id = $2)` : '';
    const params = scope ? [scope.areaIds, scope.organizationId] : [];
    const [agg] = await this.ds.query(
      `SELECT COUNT(*)::int AS total,
              COALESCE(SUM(total_estimate),0)::numeric AS total_estimate,
              COALESCE(SUM(approved_capital),0)::numeric AS approved_capital,
              COUNT(*) FILTER (WHERE phase = 'IN_PROGRESS')::int AS in_progress,
              COUNT(*) FILTER (WHERE phase NOT IN ('HANDED_OVER','WARRANTY','CLOSED','CANCELLED')
                               AND planned_end_date IS NOT NULL AND planned_end_date < now())::int AS delayed
       FROM projects ${scopeCond}`,
      params,
    );
    const disb = await this.ds.query(
      `SELECT COALESCE(SUM(m.amount),0)::numeric AS disbursed FROM project_milestones m
       JOIN projects p ON p.id = m.project_id ${scope ? 'AND (p.area_id = ANY($1::uuid[]) OR p.organization_id = $2)' : ''}
       WHERE m.kind = 'PAYMENT'`,
      params,
    );
    const byPhase = await this.ds.query(
      `SELECT phase, COUNT(*)::int AS count FROM projects ${scopeCond} GROUP BY phase`,
      params,
    );
    return {
      generatedAt: new Date().toISOString(),
      total: Number(agg.total),
      totalEstimate: Number(agg.total_estimate),
      approvedCapital: Number(agg.approved_capital),
      disbursed: Number(disb?.[0]?.disbursed ?? 0),
      inProgress: Number(agg.in_progress),
      delayed: Number(agg.delayed),
      byPhase: byPhase.map((r: Record<string, unknown>) => ({ phase: r.phase, count: Number(r.count) })),
    };
  }
}
