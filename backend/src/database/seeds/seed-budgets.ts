// Seed M14 — Dự toán ngân sách doanh trại (Thanh Hóa): niên độ 2025/2026, phân bổ hạn mức
// (liên kết dự án M13 thật), giải ngân/chứng từ; có 1 dự toán vượt chi để test cảnh báo.
// Idempotent theo mã dự toán.
import 'reflect-metadata';
import dataSource from '../data-source';
import { BudgetPlan } from '../../modules/budgets/entities/budget-plan.entity';
import { BudgetLine } from '../../modules/budgets/entities/budget-line.entity';
import { BudgetExpense } from '../../modules/budgets/entities/budget-expense.entity';

let s = 20260826;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const CATS = ['CONSTRUCTION', 'MAINTENANCE', 'EQUIPMENT', 'UTILITY', 'MATERIAL'];

async function run() {
  await dataSource.initialize();
  const plans = dataSource.getRepository(BudgetPlan);
  const lines = dataSource.getRepository(BudgetLine);
  const expenses = dataSource.getRepository(BudgetExpense);

  const org = (await dataSource.query(`SELECT id FROM organizations WHERE code = 'TINH-GL' LIMIT 1`))?.[0]?.id ?? null;
  const projects: Array<{ id: string; name: string; approved_capital: string }> =
    await dataSource.query(`SELECT id, name, approved_capital FROM projects WHERE phase <> 'CANCELLED' ORDER BY code LIMIT 10`);

  const defs = [
    { code: 'NS-2026-QP', name: 'Dự toán ngân sách quốc phòng doanh trại 2026', year: 2026, fund: 'DEFENSE_BUDGET', planned: 15_000_000_000, status: 'APPROVED', nLines: 6, spendRatio: 0.55 },
    { code: 'NS-2026-DP', name: 'Dự toán ngân sách địa phương hỗ trợ 2026', year: 2026, fund: 'LOCAL', planned: 3_000_000_000, status: 'DRAFT', nLines: 3, spendRatio: 0 },
    { code: 'NS-2025-QP', name: 'Dự toán ngân sách quốc phòng doanh trại 2025 (quyết toán)', year: 2025, fund: 'DEFENSE_BUDGET', planned: 10_000_000_000, status: 'CLOSED', nLines: 5, spendRatio: 0.95 },
    { code: 'NS-2026-OVER', name: 'Dự toán sửa chữa cấp bách 2026 (vượt chi)', year: 2026, fund: 'DEFENSE_BUDGET', planned: 1_000_000_000, status: 'APPROVED', nLines: 2, spendRatio: 1.3 },
  ];

  let createdPlans = 0, createdLines = 0, createdExp = 0, skipped = 0;
  for (const def of defs) {
    if (await plans.findOne({ where: { code: def.code } })) { skipped++; continue; }
    const plan = await plans.save(plans.create({
      code: def.code, name: def.name, fiscalYear: def.year, fundingSource: def.fund,
      organizationId: org, plannedAmount: def.planned.toString(), status: def.status,
      notes: 'Dữ liệu mẫu (seed) — cần đối chiếu quyết định giao dự toán gốc.',
      createdBy: null, updatedBy: null,
    }));
    createdPlans++;

    // Phân bổ hạn mức: chia dự toán thành nLines khoản, một số gắn dự án M13.
    const per = def.planned / def.nLines;
    const createdLineIds: string[] = [];
    for (let i = 0; i < def.nLines; i++) {
      const proj = projects.length && rnd() > 0.4 ? pick(projects) : null;
      const l = await lines.save(lines.create({
        budgetPlanId: plan.id,
        name: proj ? `Cấp vốn: ${proj.name}` : `Khoản mục ${CATS[i % CATS.length]} ${i + 1}`,
        category: pick(CATS),
        allocatedAmount: Math.round(per * (0.8 + rnd() * 0.4)).toString(),
        projectId: proj?.id ?? null,
        note: null, createdBy: null,
      }));
      createdLineIds.push(l.id);
      createdLines++;
    }

    // Giải ngân theo tỉ lệ chi (chia đều các đợt vào các khoản mục).
    const totalSpend = Math.round(def.planned * def.spendRatio);
    if (totalSpend > 0) {
      const installments = 4;
      for (let k = 1; k <= installments; k++) {
        await expenses.save(expenses.create({
          budgetPlanId: plan.id,
          budgetLineId: pick(createdLineIds),
          expenseDate: `${def.year}-${String(2 + k * 2).padStart(2, '0')}-15`,
          amount: Math.round(totalSpend / installments).toString(),
          voucherNo: `CT-${def.year}/${100 + k}`,
          description: `Giải ngân đợt ${k}`,
          projectId: null, createdBy: null,
        }));
        createdExp++;
      }
    }
  }

  console.log(`M14 seed ngân sách: +${createdPlans} dự toán (bỏ qua ${skipped}), +${createdLines} khoản mục, +${createdExp} chứng từ.`);
  await dataSource.destroy();
}

run().catch((e) => { console.error(e); process.exit(1); });
