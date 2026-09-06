// Kiểm chứng bộ biểu BCQK Đất Quốc phòng: dựng cây từ CSDL, đối chiếu tổng với file gốc,
// xuất 3 workbook (biểu 01/02/03) ra scratchpad, đọc lại biểu 01 để khẳng định dòng tổng.
// Chạy: npx ts-node -r tsconfig-paths/register scripts/verify-bcqk-reports.ts
import 'reflect-metadata';
import * as ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import dataSource from '../src/database/data-source';
import {
  buildEconomicWorkbook,
  buildFamilyWorkbook,
  buildLandFormWorkbook,
  fetchEconomicRows,
  fetchFamilyRows,
  fetchLandTree,
  LandFormMeta,
  LandFormVariant,
} from '../src/modules/reporting/land-forms';

const META: LandFormMeta = {
  provinceName: 'BỘ CHỈ HUY QUÂN SỰ THÀNH PHỐ HẢI PHÒNG',
  quanKhu: 'QUÂN KHU 3',
  periodCurrent: '2026-01-01',
  periodPrevious: '2025-01-01',
  dataSource: 'REFERENCE_HAIPHONG_2026',
  watermark: 'verify-script',
};

// Tổng chuẩn từ file gốc (dòng "THÀNH PHỐ HẢI PHÒNG (A+B+C+D+E)").
const EXPECT = {
  pointPrev: 974, areaPrev: 8567842.8,
  pointNow: 962, areaNow: 8447095.5,
  incPoint: 13, incArea: 36487, decPoint: 25, decArea: 157234.3,
};

const approx = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

async function run() {
  await dataSource.initialize();
  const tree = await fetchLandTree(dataSource, META);
  const g = tree.grand;
  const checks: Array<[string, boolean, string]> = [
    ['điểm kỳ trước', g.pointPrev === EXPECT.pointPrev, `${g.pointPrev} = ${EXPECT.pointPrev}`],
    ['DT kỳ trước', approx(g.areaPrev, EXPECT.areaPrev), `${g.areaPrev.toFixed(1)} = ${EXPECT.areaPrev}`],
    ['điểm kỳ này', g.pointNow === EXPECT.pointNow, `${g.pointNow} = ${EXPECT.pointNow}`],
    ['DT kỳ này', approx(g.areaNow, EXPECT.areaNow), `${g.areaNow.toFixed(1)} = ${EXPECT.areaNow}`],
    ['tăng điểm', g.incPoint === EXPECT.incPoint, `${g.incPoint} = ${EXPECT.incPoint}`],
    ['tăng DT', approx(g.incArea, EXPECT.incArea), `${g.incArea.toFixed(1)} = ${EXPECT.incArea}`],
    ['giảm điểm', g.decPoint === EXPECT.decPoint, `${g.decPoint} = ${EXPECT.decPoint}`],
    ['giảm DT', approx(g.decArea, EXPECT.decArea), `${g.decArea.toFixed(1)} = ${EXPECT.decArea}`],
  ];

  console.log('== Đối chiếu tổng cây (fetchLandTree) vs file gốc ==');
  let ok = true;
  for (const [name, pass, detail] of checks) {
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}: ${detail}`);
    if (!pass) ok = false;
  }
  const leaf = tree.blocks.reduce((s, b) => s + b.leaves.length, 0);
  console.log(`  Khối: ${tree.blocks.length} (${tree.blocks.map((b) => `${b.code}:${b.leaves.length}`).join(', ')}); tổng thửa: ${leaf}`);

  // Xuất 3 workbook + đọc lại biểu 01 khẳng định dòng tổng render đúng.
  const dir = tmpdir();
  for (const v of ['01', '02', '03'] as LandFormVariant[]) {
    const wb = buildLandFormWorkbook(v, tree, META);
    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    const path = join(dir, `bcqk-${v}.xlsx`);
    writeFileSync(path, buf);
    console.log(`  Đã xuất biểu ${v}: ${path} (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  // Biểu 04 (cho thuê KT): đối chiếu tổng 421365.5 m².
  const econ = await fetchEconomicRows(dataSource, META);
  const econTotal = econ.reduce((s, r) => s + r.area, 0);
  const econPass = approx(econTotal, 421365.5, 1);
  console.log(`== Biểu 04 (cho thuê KT): ${econ.length} khoản, tổng ${econTotal.toFixed(1)} m² ==`);
  console.log(`  ${econPass ? 'PASS' : 'FAIL'}  tổng cho thuê = 421365.5`);
  if (!econPass) ok = false;
  writeFileSync(join(dir, 'bcqk-04.xlsx'), Buffer.from((await buildEconomicWorkbook(econ, META).xlsx.writeBuffer()) as ArrayBuffer));
  const fam = await fetchFamilyRows(dataSource, META);
  writeFileSync(join(dir, 'bcqk-05.xlsx'), Buffer.from((await buildFamilyWorkbook(fam, META).xlsx.writeBuffer()) as ArrayBuffer));
  console.log(`  Đã xuất biểu 04 & 05 (khu GĐ: ${fam.length} bản ghi).`);

  // Đọc lại biểu 01: tìm dòng tổng "(A+B+C+D+E)" và đối chiếu ô số điểm/diện tích kỳ này.
  const wb01 = buildLandFormWorkbook('01', tree, META);
  const rt = new ExcelJS.Workbook();
  const wb01Buf = (await wb01.xlsx.writeBuffer()) as ArrayBuffer;
  await rt.xlsx.load(wb01Buf);
  const ws = rt.worksheets[0];
  let grandRowNo = -1;
  ws.eachRow((row, n) => {
    const b = String(row.getCell(2).value ?? '');
    if (grandRowNo < 0 && b.includes('(A+B+C+D+E)')) grandRowNo = n;
  });
  if (grandRowNo > 0) {
    const row = ws.getRow(grandRowNo);
    // Cột biểu 01: 1 STT,2 name,3 xã,4 huyện,5 tỉnh,6 điểm kỳ trước,7 DT kỳ trước,
    // 8/9 tăng,10/11 giảm,12 điểm kỳ này,13 DT kỳ này...
    const pNow = Number(row.getCell(12).value ?? 0);
    const aNow = Number(row.getCell(13).value ?? 0);
    const passRender = pNow === EXPECT.pointNow && approx(aNow, EXPECT.areaNow);
    console.log(`== Đọc lại biểu 01 (dòng ${grandRowNo}) ==`);
    console.log(`  ${passRender ? 'PASS' : 'FAIL'}  render kỳ này: điểm=${pNow}, DT=${aNow.toFixed(1)}`);
    if (!passRender) ok = false;
  } else {
    console.log('  FAIL  không tìm thấy dòng tổng trong biểu 01');
    ok = false;
  }

  await dataSource.destroy();
  console.log(ok ? '\n✅ TẤT CẢ ĐỐI CHIẾU KHỚP.' : '\n❌ CÓ SAI LỆCH.');
  process.exit(ok ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
