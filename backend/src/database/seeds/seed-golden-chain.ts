// Orchestrator "chuỗi vàng" (§2 Hardening): chạy tuần tự các seed DT-01→DT-12 hiện có để
// dựng dữ liệu demo xuyên phân hệ, phục vụ golden-chain.int-spec + nghiệm thu TC-HD-001.
// Mỗi seed con là script idempotent tự mở/đóng DataSource riêng ⇒ chạy nối tiếp an toàn.
// Dùng: `npm run seed:golden-chain`.
import { execSync } from 'child_process';

// Thứ tự bám phụ thuộc dữ liệu (00-README §4): nền → danh mục → kỹ thuật → định mức →
// kiểm kê (official snapshot) → báo cáo (dataset từ snapshot) → dashboard (KPI từ snapshot).
const STEPS: Array<{ label: string; script: string }> = [
  { label: 'Nền (org/users/master data)', script: 'seed' },
  { label: 'DT-01 Danh mục chuẩn R00', script: 'seed:catalog-dt01' },
  { label: 'DT-03 Hồ sơ kỹ thuật (model/revision)', script: 'seed:technical-dt03' },
  { label: 'DT-07 Định mức có căn cứ + chỉ lệnh', script: 'seed:norms-dt07' },
  { label: 'DT-10 Kiểm kê + official snapshot', script: 'seed:count-dt10' },
  { label: 'DT-11 Report engine (17 biểu + dataset)', script: 'seed:report-dt11' },
  { label: 'DT-12 Dashboard KPI + Data Mart', script: 'seed:dashboard-dt12' },
];

function run() {
  console.log('=== SEED GOLDEN CHAIN (DT-01 → DT-12) ===');
  const t0 = Date.now();
  for (const [i, step] of STEPS.entries()) {
    const n = i + 1;
    console.log(`\n[${n}/${STEPS.length}] ${step.label}  →  npm run ${step.script}`);
    try {
      execSync(`npm run ${step.script}`, { stdio: 'inherit' });
    } catch (e) {
      console.error(`\n✗ Bước ${n} (${step.script}) THẤT BẠI — dừng chuỗi.`);
      throw e;
    }
  }
  console.log(`\n✓ Chuỗi vàng seed xong ${STEPS.length} bước trong ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

try {
  run();
} catch {
  process.exit(1);
}
