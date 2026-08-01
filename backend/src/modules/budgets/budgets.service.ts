import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BudgetPlan } from './entities/budget-plan.entity';
import { BudgetLine } from './entities/budget-line.entity';
import { BudgetExpense } from './entities/budget-expense.entity';
import {
  CreateBudgetLineDto,
  CreateBudgetPlanDto,
  CreateExpenseDto,
  UpdateBudgetLineDto,
  UpdateBudgetPlanDto,
} from './dto/budget.dto';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { barracksScope } from '../../common/data-scope';

export interface BudgetFilters {
  search?: string;
  fiscalYear?: string;
  fundingSource?: string;
  status?: string;
}

// M14 — Kế hoạch & ngân sách. Dự toán (DRAFT→APPROVED→CLOSED) + phân bổ hạn mức + giải ngân/
// chứng từ + đối chiếu dự toán/thực chi. Không xóa cứng. Dữ liệu tài chính giới hạn theo quyền.
@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(BudgetPlan) private readonly plans: Repository<BudgetPlan>,
    @InjectRepository(BudgetLine) private readonly lines: Repository<BudgetLine>,
    @InjectRepository(BudgetExpense) private readonly expenses: Repository<BudgetExpense>,
    private readonly ds: DataSource,
  ) {}

  async list(q: PaginationQuery, filters: BudgetFilters, user?: AuthUser) {
    const scope = barracksScope(user);
    const qb = this.plans
      .createQueryBuilder('p')
      .leftJoin('organizations', 'o', 'o.id = p.organization_id')
      .select('p.id', 'id')
      .addSelect('p.code', 'code')
      .addSelect('p.name', 'name')
      .addSelect('p.fiscal_year', 'fiscalYear')
      .addSelect('p.funding_source', 'fundingSource')
      .addSelect('p.planned_amount', 'plannedAmount')
      .addSelect('p.status', 'status')
      .addSelect('p.updated_at', 'updatedAt')
      .addSelect('o.name', 'orgName')
      .addSelect((sub) => sub.select('COALESCE(SUM(l.allocated_amount),0)').from('budget_lines', 'l').where('l.budget_plan_id = p.id'), 'allocated')
      .addSelect((sub) => sub.select('COALESCE(SUM(e.amount),0)').from('budget_expenses', 'e').where('e.budget_plan_id = p.id'), 'spent')
      .orderBy('p.fiscal_year', 'DESC')
      .addOrderBy('p.code', 'ASC')
      .offset(q.skip)
      .limit(q.size);

    const countQb = this.plans.createQueryBuilder('p');
    const apply = (b: typeof qb | typeof countQb) => {
      if (filters.search) b.andWhere('(p.code ILIKE :s OR p.name ILIKE :s)', { s: `%${filters.search}%` });
      if (filters.fiscalYear) b.andWhere('p.fiscal_year = :fy', { fy: Number(filters.fiscalYear) });
      if (filters.fundingSource) b.andWhere('p.funding_source = :fs', { fs: filters.fundingSource });
      if (filters.status) b.andWhere('p.status = :st', { st: filters.status });
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
        fiscalYear: Number(r.fiscalYear),
        fundingSource: r.fundingSource,
        plannedAmount: Number(r.plannedAmount),
        allocated: Number(r.allocated),
        spent: Number(r.spent),
        status: r.status,
        updatedAt: r.updatedAt,
        orgName: r.orgName,
      })),
      total,
      q,
    );
  }

  async get(id: string) {
    const plan = await this.plans.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('DATA-001: Không tìm thấy dự toán');
    const [agg] = await this.ds.query(
      `SELECT o.name AS org_name, a.name AS area_name,
              (SELECT COALESCE(SUM(l.allocated_amount),0) FROM budget_lines l WHERE l.budget_plan_id = p.id) AS allocated,
              (SELECT COALESCE(SUM(e.amount),0) FROM budget_expenses e WHERE e.budget_plan_id = p.id) AS spent
       FROM budget_plans p
       LEFT JOIN organizations o ON o.id = p.organization_id
       LEFT JOIN administrative_areas a ON a.id = p.area_id
       WHERE p.id = $1`,
      [id],
    );
    // Khoản mục + thực chi từng khoản (đối chiếu hạn mức).
    const lines = await this.ds.query(
      `SELECT l.id, l.name, l.category, l.allocated_amount AS "allocatedAmount", l.project_id AS "projectId",
              l.note, pr.name AS "projectName",
              (SELECT COALESCE(SUM(e.amount),0) FROM budget_expenses e WHERE e.budget_line_id = l.id) AS spent
       FROM budget_lines l
       LEFT JOIN projects pr ON pr.id = l.project_id
       WHERE l.budget_plan_id = $1 ORDER BY l.created_at ASC`,
      [id],
    );
    return {
      ...plan,
      orgName: agg?.org_name ?? null,
      areaName: agg?.area_name ?? null,
      allocated: Number(agg?.allocated ?? 0),
      spent: Number(agg?.spent ?? 0),
      remaining: Number(plan.plannedAmount) - Number(agg?.spent ?? 0),
      lines: lines.map((l: Record<string, unknown>) => ({
        id: l.id,
        name: l.name,
        category: l.category,
        allocatedAmount: Number(l.allocatedAmount),
        spent: Number(l.spent),
        projectId: l.projectId,
        projectName: l.projectName,
        note: l.note,
      })),
    };
  }

  async create(dto: CreateBudgetPlanDto, user: AuthUser): Promise<BudgetPlan> {
    const dup = await this.plans.findOne({ where: { code: dto.code } });
    if (dup) throw new ConflictException(`DATA-003: Trùng mã dự toán ${dto.code}`);
    return this.plans.save(this.plans.create({
      code: dto.code,
      name: dto.name,
      fiscalYear: dto.fiscalYear,
      fundingSource: dto.fundingSource ?? null,
      organizationId: dto.organizationId ?? user.organizationId ?? null,
      areaId: dto.areaId ?? null,
      plannedAmount: (dto.plannedAmount ?? 0).toString(),
      status: 'DRAFT',
      notes: dto.notes ?? null,
      createdBy: user.sub,
      updatedBy: user.sub,
    }));
  }

  async update(id: string, dto: UpdateBudgetPlanDto, user: AuthUser): Promise<BudgetPlan> {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự toán');
    if (p.status === 'CLOSED') throw new ConflictException('WF-001: Dự toán đã quyết toán, không thể sửa');
    if (dto.name !== undefined) p.name = dto.name;
    if (dto.fiscalYear !== undefined) p.fiscalYear = dto.fiscalYear;
    if (dto.fundingSource !== undefined) p.fundingSource = dto.fundingSource || null;
    if (dto.organizationId !== undefined) p.organizationId = dto.organizationId || null;
    if (dto.areaId !== undefined) p.areaId = dto.areaId || null;
    if (dto.plannedAmount !== undefined) p.plannedAmount = dto.plannedAmount.toString();
    if (dto.notes !== undefined) p.notes = dto.notes || null;
    p.updatedBy = user.sub;
    return this.plans.save(p);
  }

  async approve(id: string, user: AuthUser): Promise<BudgetPlan> {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự toán');
    if (p.status !== 'DRAFT') throw new ConflictException('WF-001: Chỉ chốt dự toán ở trạng thái nháp');
    p.status = 'APPROVED';
    p.updatedBy = user.sub;
    return this.plans.save(p);
  }

  async close(id: string, user: AuthUser): Promise<BudgetPlan> {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự toán');
    if (p.status !== 'APPROVED') throw new ConflictException('WF-001: Chỉ quyết toán dự toán đã chốt');
    p.status = 'CLOSED';
    p.updatedBy = user.sub;
    return this.plans.save(p);
  }

  // ── Khoản mục / hạn mức ─────────────────────────────────────
  private async assertEditablePlan(planId: string): Promise<BudgetPlan> {
    const p = await this.plans.findOne({ where: { id: planId } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự toán');
    if (p.status === 'CLOSED') throw new ConflictException('WF-001: Dự toán đã quyết toán, không thể thay đổi');
    return p;
  }

  async addLine(planId: string, dto: CreateBudgetLineDto, user: AuthUser) {
    await this.assertEditablePlan(planId);
    return this.lines.save(this.lines.create({
      budgetPlanId: planId,
      name: dto.name,
      category: dto.category ?? 'OTHER',
      allocatedAmount: dto.allocatedAmount.toString(),
      projectId: dto.projectId ?? null,
      note: dto.note ?? null,
      createdBy: user.sub,
    }));
  }

  async updateLine(planId: string, lineId: string, dto: UpdateBudgetLineDto) {
    await this.assertEditablePlan(planId);
    const l = await this.lines.findOne({ where: { id: lineId, budgetPlanId: planId } });
    if (!l) throw new NotFoundException('DATA-001: Không tìm thấy khoản mục');
    if (dto.name !== undefined) l.name = dto.name;
    if (dto.category !== undefined) l.category = dto.category;
    if (dto.allocatedAmount !== undefined) l.allocatedAmount = dto.allocatedAmount.toString();
    if (dto.projectId !== undefined) l.projectId = dto.projectId || null;
    if (dto.note !== undefined) l.note = dto.note || null;
    return this.lines.save(l);
  }

  async removeLine(planId: string, lineId: string) {
    await this.assertEditablePlan(planId);
    const l = await this.lines.findOne({ where: { id: lineId, budgetPlanId: planId } });
    if (!l) throw new NotFoundException('DATA-001: Không tìm thấy khoản mục');
    await this.lines.remove(l);
    return { deleted: true };
  }

  // ── Giải ngân / chứng từ ────────────────────────────────────
  async listExpenses(planId: string) {
    const rows = await this.ds.query(
      `SELECT e.id, e.expense_date AS "expenseDate", e.amount, e.voucher_no AS "voucherNo",
              e.description, e.budget_line_id AS "budgetLineId", l.name AS "lineName",
              e.project_id AS "projectId", pr.name AS "projectName"
       FROM budget_expenses e
       LEFT JOIN budget_lines l ON l.id = e.budget_line_id
       LEFT JOIN projects pr ON pr.id = e.project_id
       WHERE e.budget_plan_id = $1 ORDER BY e.expense_date DESC, e.created_at DESC`,
      [planId],
    );
    return rows.map((r: Record<string, unknown>) => ({ ...r, amount: Number(r.amount) }));
  }

  async addExpense(planId: string, dto: CreateExpenseDto, user: AuthUser) {
    const p = await this.plans.findOne({ where: { id: planId } });
    if (!p) throw new NotFoundException('DATA-001: Không tìm thấy dự toán');
    if (p.status === 'CLOSED') throw new ConflictException('WF-001: Dự toán đã quyết toán, không ghi thêm chi');
    return this.expenses.save(this.expenses.create({
      budgetPlanId: planId,
      budgetLineId: dto.budgetLineId ?? null,
      expenseDate: dto.expenseDate,
      amount: dto.amount.toString(),
      voucherNo: dto.voucherNo ?? null,
      description: dto.description ?? null,
      projectId: dto.projectId ?? null,
      createdBy: user.sub,
    }));
  }

  async removeExpense(planId: string, expenseId: string) {
    const p = await this.plans.findOne({ where: { id: planId } });
    if (p?.status === 'CLOSED') throw new ConflictException('WF-001: Dự toán đã quyết toán');
    const e = await this.expenses.findOne({ where: { id: expenseId, budgetPlanId: planId } });
    if (!e) throw new NotFoundException('DATA-001: Không tìm thấy chứng từ');
    await this.expenses.remove(e);
    return { deleted: true };
  }

  // Tổng hợp ngân sách theo niên độ (dự toán vs thực chi, số dự toán vượt chi).
  async summary(user?: AuthUser) {
    const scope = barracksScope(user);
    const cond = scope ? `WHERE (area_id = ANY($1::uuid[]) OR organization_id = $2)` : '';
    const params = scope ? [scope.areaIds, scope.organizationId] : [];
    const byYear = await this.ds.query(
      `SELECT p.fiscal_year AS "fiscalYear",
              COUNT(*)::int AS plans,
              COALESCE(SUM(p.planned_amount),0)::numeric AS planned,
              COALESCE((SELECT SUM(e.amount) FROM budget_expenses e JOIN budget_plans p2 ON p2.id=e.budget_plan_id
                        WHERE p2.fiscal_year = p.fiscal_year ${scope ? 'AND (p2.area_id = ANY($1::uuid[]) OR p2.organization_id = $2)' : ''}),0)::numeric AS spent
       FROM budget_plans p ${cond}
       GROUP BY p.fiscal_year ORDER BY p.fiscal_year DESC`,
      params,
    );
    return {
      generatedAt: new Date().toISOString(),
      byYear: byYear.map((r: Record<string, unknown>) => ({
        fiscalYear: Number(r.fiscalYear),
        plans: Number(r.plans),
        planned: Number(r.planned),
        spent: Number(r.spent),
      })),
    };
  }
}
