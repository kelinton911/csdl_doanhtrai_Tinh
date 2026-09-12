// Feature 03 (SSCĐ) — Seed 3 phương án phân cấp lượng vật chất SSCĐ (Tăng cường/Cao/Toàn bộ)
// của cấp Tỉnh, mỗi phương án vài dòng vật chất phân bổ theo 4 cấp (kho Tỉnh/xã/trung đoàn/căn cứ).
// Idempotent theo (readiness_state, period_label). Cần đã có material_catalog (seed danh mục trước).
import 'reflect-metadata';
import dataSource from '../data-source';
import { ReadinessAllocationPlan } from '../../modules/readiness-materials/entities/readiness-allocation-plan.entity';
import { ReadinessAllocationLine } from '../../modules/readiness-materials/entities/readiness-allocation-line.entity';
import { SSCD_ALLOCATION_STATES, READINESS_STATE_LABEL } from '../../modules/readiness-materials/readiness-material.constants';
import { WorkflowStatus } from '../../common/workflow';

const PERIOD = '2026';

// Hệ số lượng theo trạng thái (tăng dần theo mức SSCĐ).
const STATE_FACTOR: Record<string, number> = { TANG_CUONG: 1, CAO: 1.5, TOAN_BO: 2 };

async function run() {
  await dataSource.initialize();
  const planRepo = dataSource.getRepository(ReadinessAllocationPlan);
  const lineRepo = dataSource.getRepository(ReadinessAllocationLine);

  // Lấy vài mã vật chất lá làm mẫu (ưu tiên danh mục chuẩn R00/Quân nhu).
  const items: Array<{ id: string; code: string; unit_id: string | null }> = await dataSource.query(
    `SELECT id, code, unit_id FROM material_catalog WHERE is_leaf = true ORDER BY code ASC LIMIT 8`,
  );
  if (items.length === 0) {
    console.error('material_catalog trống — hãy chạy seed danh mục (seed:catalog-dt01 / seed:r00-catalog) trước.');
    await dataSource.destroy();
    process.exit(1);
  }

  let plansCreated = 0;
  let linesCreated = 0;
  for (const state of SSCD_ALLOCATION_STATES) {
    let plan = await planRepo.findOne({ where: { readinessState: state, periodLabel: PERIOD } });
    if (!plan) {
      plan = await planRepo.save(
        planRepo.create({
          readinessState: state,
          title: `Phương án SSCĐ ${READINESS_STATE_LABEL[state]} — ${PERIOD}`,
          regulationRef: `Chỉ lệnh SSCĐ Quân khu (mẫu) số .../${PERIOD}`,
          periodLabel: PERIOD,
          workflowStatus: WorkflowStatus.DRAFT,
          notes: 'Dữ liệu mẫu phục vụ kiểm thử.',
        }),
      );
      plansCreated++;
    }
    // Chỉ nạp dòng nếu phương án chưa có dòng nào (idempotent).
    const existingLines = await lineRepo.count({ where: { planId: plan.id } });
    if (existingLines > 0) continue;
    const f = STATE_FACTOR[state] ?? 1;
    const rows = items.map((it, idx) => {
      const khoTinh = Math.round((100 + idx * 20) * f);
      const xa = Math.round((40 + idx * 10) * f);
      const trungDoan = Math.round((30 + idx * 5) * f);
      const canCu = Math.round((20 + idx * 5) * f);
      return lineRepo.create({
        planId: plan!.id,
        materialCatalogId: it.id,
        unitId: it.unit_id,
        qtyKhoTinh: khoTinh.toString(),
        qtyXa: xa.toString(),
        qtyTrungDoan: trungDoan.toString(),
        qtyCanCu: canCu.toString(),
        qtyTotal: (khoTinh + xa + trungDoan + canCu).toString(),
        sortOrder: idx,
      });
    });
    await lineRepo.save(rows);
    linesCreated += rows.length;
  }

  console.log(
    `SSCĐ allocation seed: phương án mới=${plansCreated}/${SSCD_ALLOCATION_STATES.length} (kỳ ${PERIOD}); ` +
      `dòng phân cấp lượng mới=${linesCreated}; vật chất mẫu=${items.length} mã.`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
