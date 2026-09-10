// Orchestrator "chuỗi vàng" — bộ seed dữ liệu mẫu LIÊN KẾT xuyên phân hệ, anchor Tỉnh Thanh Hóa.
// Chạy TIỀN ĐỀ (GIS Thanh Hóa nếu thiếu + asset-catalog + official-catalog) rồi 00→12 theo đúng
// thứ tự luồng dữ liệu chuẩn (DT-01→DT-12), dùng CHUNG một DataSource ⇒ dữ liệu nối liền.
// Idempotent (chạy lại an toàn). Dùng: `npm run seed:chain` (5435) · `DB_PORT=5436 npm run seed:chain`.
import 'reflect-metadata';
import { execSync } from 'child_process';
import dataSource from '../../data-source';
import { PROVINCE_AREA_CODE } from './_shared/demo-ids';

import { run as step00 } from './00-foundation';
import { run as step01 } from './01-catalog';
import { run as step02 } from './02-barracks-land';
import { run as step03 } from './03-technical';
import { run as step04 } from './04-materiel';
import { run as step05 } from './05-documents';
import { run as step06 } from './06-allocation';
import { run as step07 } from './07-norms';
import { run as step08 } from './08-calculation';
import { run as step09 } from './09-balance';
import { run as step10 } from './10-inventory-count';
import { run as step11 } from './11-report';
import { run as step12 } from './12-dashboard';

// Bộ dữ liệu GIS người dùng cung cấp (docs/). Toàn quốc (tỉnh + xã có province_code) — gồm Thanh Hóa '38'.
const GIS_PROVINCES = '../docs/vietnam_gis_admin_2026_geojson/vietnam_gis_admin_2026/vietnam_provinces_2026.geojson';
const GIS_COMMUNES = '../docs/vietnam_gis_admin_2026_geojson/vietnam_gis_admin_2026/vietnam_communes_2026_attributes.geojson';

const sh = (cmd: string) => execSync(cmd, { stdio: 'inherit', env: process.env });

async function ensurePrereqs(): Promise<void> {
  // 1) GIS Thanh Hóa — nạp nếu chưa có tỉnh '38'.
  const prov = await dataSource.query(
    `SELECT count(*)::int AS c FROM administrative_areas WHERE code = $1 AND level = 'PROVINCE'`,
    [PROVINCE_AREA_CODE],
  );
  if (Number(prov?.[0]?.c ?? 0) === 0) {
    console.log('  · Chưa có địa bàn Thanh Hóa → nạp GIS (provinces + communes attributes)…');
    sh(`npm run seed:geojson -- ${GIS_PROVINCES} ${GIS_COMMUNES}`);
  } else {
    console.log('  · GIS đã có (tỉnh 38) — bỏ qua nạp địa giới.');
  }

  // 2) Danh mục tài sản ngành (asset_catalog_items) — cho màn cũ + loại công trình.
  const ac = await dataSource.query(`SELECT count(*)::int AS c FROM asset_catalog_items`);
  if (Number(ac?.[0]?.c ?? 0) === 0) {
    console.log('  · asset_catalog_items trống → seed:asset-catalog + seed:official-catalog…');
    sh('npm run seed:asset-catalog');
    sh('npm run seed:official-catalog');
  } else {
    console.log('  · asset_catalog_items đã có — bỏ qua.');
  }
}

const STEPS: Array<{ label: string; run: (ds: typeof dataSource) => Promise<void> }> = [
  { label: '[00] Nền + địa bàn Thanh Hóa (166 xã)', run: step00 },
  { label: '[01] DT-01 Danh mục R00', run: step01 },
  { label: '[02] DT-02 Doanh trại + đất', run: step02 },
  { label: '[03] DT-03 Hồ sơ kỹ thuật', run: step03 },
  { label: '[04] DT-04 Thực lực + snapshot HC', run: step04 },
  { label: '[05] DT-05 Chứng từ + điều chuyển', run: step05 },
  { label: '[06] DT-06 Phân bổ + hold', run: step06 },
  { label: '[07] DT-07 Định mức + chỉ lệnh', run: step07 },
  { label: '[08] DT-08 Tính nhu cầu (NC)', run: step08 },
  { label: '[09] DT-09 Nguồn + cân đối', run: step09 },
  { label: '[10] DT-10 Kiểm kê + official snapshot', run: step10 },
  { label: '[11] DT-11 Report engine (17 biểu)', run: step11 },
  { label: '[12] DT-12 Dashboard KPI + metric', run: step12 },
];

async function main(): Promise<void> {
  console.log('=== SEED CHUỖI VÀNG (anchor Thanh Hóa · DT-01 → DT-12) ===');
  const t0 = Date.now();
  await dataSource.initialize();
  try {
    await ensurePrereqs();
    for (const [i, step] of STEPS.entries()) {
      console.log(`\n[${i + 1}/${STEPS.length}] ${step.label}`);
      await step.run(dataSource);
    }
  } finally {
    await dataSource.destroy();
  }

  // Hậu tố (tiến trình riêng, idempotent, KHÔNG bắt buộc): RBAC backfill từ users + danh mục C3.
  // Lỗi ở đây không làm hỏng dữ liệu chuỗi đã seed ⇒ chỉ cảnh báo.
  console.log('\n  · Hậu tố: seed:rbac + seed:c3-catalog…');
  for (const cmd of ['npm run seed:rbac', 'npm run seed:c3-catalog']) {
    try {
      sh(cmd);
    } catch {
      console.warn(`  ! Bỏ qua hậu tố (không bắt buộc): ${cmd}`);
    }
  }

  console.log(`\n✓ Chuỗi vàng seed xong ${STEPS.length} bước trong ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
}

main().catch((err) => {
  console.error('Seed chuỗi vàng lỗi:', err);
  process.exit(1);
});
