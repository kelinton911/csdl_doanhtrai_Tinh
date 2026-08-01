import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskUpdate } from './entities/task-update.entity';
import {
  CreateTaskDto,
  ReviewTaskDto,
  SubmitDto,
  TaskUpdateDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface TaskFilters {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assigneeAreaId?: string;
  parentTaskId?: string;
  topLevel?: string;
  mine?: string;
}
const TERMINAL = ['COMPLETED', 'CANCELLED'];

// M21 — Kế hoạch công tác & giao nhiệm vụ. CRUD + giao xuống đơn vị/địa bàn/người + vòng đời
// (ASSIGNED→IN_PROGRESS→SUBMITTED→COMPLETED) + nhật ký tiến độ + cây nhiệm vụ. Không xóa cứng.
@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly repo: Repository<Task>,
    @InjectRepository(TaskUpdate) private readonly updates: Repository<TaskUpdate>,
    private readonly ds: DataSource,
  ) {}

  async list(q: PaginationQuery, filters: TaskFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.repo
      .createQueryBuilder('t')
      .leftJoin('organizations', 'ao', 'ao.id = t.assignee_org_id')
      .leftJoin('administrative_areas', 'aa', 'aa.id = t.assignee_area_id')
      .leftJoin('users', 'au', 'au.id = t.assignee_user_id')
      .select('t.id', 'id').addSelect('t.code', 'code').addSelect('t.title', 'title')
      .addSelect('t.category', 'category').addSelect('t.priority', 'priority')
      .addSelect('t.due_date', 'dueDate').addSelect('t.progress_percent', 'progressPercent')
      .addSelect('t.status', 'status').addSelect('t.parent_task_id', 'parentTaskId')
      .addSelect('t.updated_at', 'updatedAt')
      .addSelect('ao.name', 'assigneeOrgName').addSelect('aa.name', 'assigneeAreaName').addSelect('au.full_name', 'assigneeUserName')
      .orderBy(`CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END`, 'ASC')
      .addOrderBy('t.due_date', 'ASC')
      .offset(q.skip).limit(q.size);

    const countQb = this.repo.createQueryBuilder('t');
    const apply = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(t.code ILIKE :s OR t.title ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.status) b.andWhere('t.status = :st', { st: filters.status });
      if (filters.priority) b.andWhere('t.priority = :pr', { pr: filters.priority });
      if (filters.category) b.andWhere('t.category = :cat', { cat: filters.category });
      if (filters.assigneeAreaId) b.andWhere('t.assignee_area_id = :aid', { aid: filters.assigneeAreaId });
      if (filters.parentTaskId) b.andWhere('t.parent_task_id = :pid', { pid: filters.parentTaskId });
      if (filters.topLevel === 'true') b.andWhere('t.parent_task_id IS NULL');
      if (filters.mine === 'true' && user) {
        b.andWhere('(t.assignee_user_id = :uid OR t.assignee_org_id = :uorg)', { uid: user.sub, uorg: user.organizationId ?? null });
      } else if (scope) {
        b.andWhere('(t.assignee_area_id = ANY(:areaIds::uuid[]) OR t.assignee_org_id = :orgId OR t.assignee_user_id = :sub)', { areaIds: scope.areaIds, orgId: scope.organizationId, sub: user?.sub });
      }
    };
    apply(qb);
    apply(countQb);

    const rows = await qb.getRawMany();
    const total = await countQb.getCount();
    return paginated(
      rows.map((r) => ({
        id: r.id, code: r.code, title: r.title, category: r.category, priority: r.priority,
        dueDate: r.dueDate, progressPercent: Number(r.progressPercent), status: r.status,
        parentTaskId: r.parentTaskId, updatedAt: r.updatedAt,
        assignee: r.assigneeUserName || r.assigneeOrgName || r.assigneeAreaName || null,
      })),
      total,
      q,
    );
  }

  async get(id: string) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ');
    const [meta] = await this.ds.query(
      `SELECT ag.name AS assigner, ao.name AS assignee_org, aa.name AS assignee_area, au.full_name AS assignee_user,
              pt.title AS parent_title
       FROM tasks t
       LEFT JOIN organizations ag ON ag.id = t.assigner_org_id
       LEFT JOIN organizations ao ON ao.id = t.assignee_org_id
       LEFT JOIN administrative_areas aa ON aa.id = t.assignee_area_id
       LEFT JOIN users au ON au.id = t.assignee_user_id
       LEFT JOIN tasks pt ON pt.id = t.parent_task_id
       WHERE t.id = $1`,
      [id],
    );
    const children = await this.ds.query(
      `SELECT id, code, title, status, progress_percent AS "progressPercent", priority, due_date AS "dueDate"
       FROM tasks WHERE parent_task_id = $1 ORDER BY code ASC`,
      [id],
    );
    return {
      ...t,
      assignerName: meta?.assigner ?? null,
      assigneeOrgName: meta?.assignee_org ?? null,
      assigneeAreaName: meta?.assignee_area ?? null,
      assigneeUserName: meta?.assignee_user ?? null,
      parentTitle: meta?.parent_title ?? null,
      children: children.map((c: Record<string, unknown>) => ({ ...c, progressPercent: Number(c.progressPercent) })),
    };
  }

  async create(dto: CreateTaskDto, user: AuthUser): Promise<Task> {
    const dup = await this.repo.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã nhiệm vụ ${dto.code}`);
    return this.repo.save(this.repo.create({
      code: dto.code, title: dto.title, description: dto.description ?? null,
      category: dto.category ?? 'OTHER', priority: dto.priority ?? 'NORMAL',
      assignerOrgId: user.organizationId ?? null,
      assigneeOrgId: dto.assigneeOrgId ?? null, assigneeAreaId: dto.assigneeAreaId ?? null, assigneeUserId: dto.assigneeUserId ?? null,
      dueDate: dto.dueDate ?? null,
      targetValue: dto.targetValue != null ? dto.targetValue.toString() : null, targetUnit: dto.targetUnit ?? null,
      parentTaskId: dto.parentTaskId ?? null,
      linkedEntityType: dto.linkedEntityType ?? null, linkedEntityId: dto.linkedEntityId ?? null,
      status: 'ASSIGNED', progressPercent: 0,
      createdBy: user.sub, updatedBy: user.sub,
    }));
  }

  async update(id: string, dto: UpdateTaskDto, user: AuthUser): Promise<Task> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ');
    if (TERMINAL.includes(t.status)) throw new ConflictException(`WF-001: Nhiệm vụ đã ${t.status}, không thể sửa`);
    if (dto.title !== undefined) t.title = dto.title;
    if (dto.description !== undefined) t.description = dto.description || null;
    if (dto.category !== undefined) t.category = dto.category;
    if (dto.priority !== undefined) t.priority = dto.priority;
    if (dto.assigneeOrgId !== undefined) t.assigneeOrgId = dto.assigneeOrgId || null;
    if (dto.assigneeAreaId !== undefined) t.assigneeAreaId = dto.assigneeAreaId || null;
    if (dto.assigneeUserId !== undefined) t.assigneeUserId = dto.assigneeUserId || null;
    if (dto.dueDate !== undefined) t.dueDate = dto.dueDate || null;
    if (dto.targetValue !== undefined) t.targetValue = dto.targetValue != null ? dto.targetValue.toString() : null;
    if (dto.targetUnit !== undefined) t.targetUnit = dto.targetUnit || null;
    if (dto.resultValue !== undefined) t.resultValue = dto.resultValue != null ? dto.resultValue.toString() : null;
    if (dto.parentTaskId !== undefined) t.parentTaskId = dto.parentTaskId || null;
    if (dto.linkedEntityType !== undefined) t.linkedEntityType = dto.linkedEntityType || null;
    if (dto.linkedEntityId !== undefined) t.linkedEntityId = dto.linkedEntityId || null;
    t.updatedBy = user.sub;
    return this.repo.save(t);
  }

  private async load(id: string): Promise<Task> {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('DATA-001: Không tìm thấy nhiệm vụ');
    return t;
  }

  async start(id: string, user: AuthUser): Promise<Task> {
    const t = await this.load(id);
    if (t.status !== 'ASSIGNED') throw new ConflictException('WF-001: Chỉ bắt đầu nhiệm vụ đang giao');
    t.status = 'IN_PROGRESS'; t.updatedBy = user.sub;
    return this.repo.save(t);
  }

  async submit(id: string, dto: SubmitDto, user: AuthUser): Promise<Task> {
    const t = await this.load(id);
    if (!['IN_PROGRESS', 'ASSIGNED'].includes(t.status)) throw new ConflictException('WF-001: Chỉ nộp nhiệm vụ đang thực hiện');
    t.status = 'SUBMITTED';
    if (dto.resultNote !== undefined) t.resultNote = dto.resultNote || null;
    if (dto.resultValue !== undefined) t.resultValue = dto.resultValue != null ? dto.resultValue.toString() : null;
    t.updatedBy = user.sub;
    return this.repo.save(t);
  }

  async accept(id: string, user: AuthUser): Promise<Task> {
    const t = await this.load(id);
    if (t.status !== 'SUBMITTED') throw new ConflictException('WF-001: Chỉ nghiệm thu nhiệm vụ đã nộp');
    t.status = 'COMPLETED'; t.progressPercent = 100; t.completedAt = new Date(); t.updatedBy = user.sub;
    return this.repo.save(t);
  }

  async reject(id: string, dto: ReviewTaskDto, user: AuthUser): Promise<Task> {
    const t = await this.load(id);
    if (t.status !== 'SUBMITTED') throw new ConflictException('WF-001: Chỉ trả lại nhiệm vụ đã nộp');
    t.status = 'IN_PROGRESS'; t.updatedBy = user.sub;
    await this.repo.save(t);
    await this.updates.save(this.updates.create({ taskId: id, kind: 'COMMENT', note: `Trả lại: ${dto.note ?? ''}`, createdBy: user.sub }));
    return t;
  }

  async cancel(id: string, user: AuthUser): Promise<Task> {
    const t = await this.load(id);
    if (TERMINAL.includes(t.status)) throw new ConflictException('WF-001: Nhiệm vụ đã kết thúc');
    t.status = 'CANCELLED'; t.updatedBy = user.sub;
    return this.repo.save(t);
  }

  async listUpdates(taskId: string) {
    return this.updates.find({ where: { taskId }, order: { createdAt: 'DESC' } });
  }

  async addUpdate(taskId: string, dto: TaskUpdateDto, user: AuthUser) {
    const t = await this.load(taskId);
    const saved = await this.updates.save(this.updates.create({
      taskId, kind: dto.kind ?? 'PROGRESS', progressPercent: dto.progressPercent ?? null, note: dto.note ?? null, createdBy: user.sub,
    }));
    // Cập nhật tiến độ nhiệm vụ (không lùi) + tự chuyển sang đang thực hiện.
    if (saved.kind === 'PROGRESS' && saved.progressPercent != null) {
      if (t.status === 'ASSIGNED') t.status = 'IN_PROGRESS';
      if (saved.progressPercent > t.progressPercent) t.progressPercent = saved.progressPercent;
      t.updatedBy = user.sub;
      await this.repo.save(t);
    }
    return saved;
  }

  async summary(user?: AuthUser) {
    const scope = barracksScope(user);
    const cond = scope ? `WHERE (assignee_area_id = ANY($1::uuid[]) OR assignee_org_id = $2 OR assignee_user_id = $3)` : '';
    const params = scope ? [scope.areaIds, scope.organizationId, user?.sub ?? null] : [];
    const [agg] = await this.ds.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
              COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS submitted,
              COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
              COUNT(*) FILTER (WHERE status NOT IN ('COMPLETED','CANCELLED') AND due_date IS NOT NULL AND due_date < now())::int AS overdue
       FROM tasks ${cond}`,
      params,
    );
    return {
      generatedAt: new Date().toISOString(),
      total: Number(agg.total), inProgress: Number(agg.in_progress),
      submitted: Number(agg.submitted), completed: Number(agg.completed), overdue: Number(agg.overdue),
    };
  }
}
