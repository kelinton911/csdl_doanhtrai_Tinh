// Bộ 5 biểu BCQK Đất Quốc phòng (nộp QK3): dựng cây phân cấp Tỉnh → Khối A–E → thửa,
// sinh dòng cộng từng cấp + dòng tổng toàn TP, render Excel có header gộp ô nhiều tầng.
// Số liệu kỳ trước lấy từ land_period_snapshots; tăng/giảm = chênh lệch kỳ này ↔ kỳ trước.
import * as ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';

export type LandFormVariant = '01' | '02' | '03' | '04' | '05';

export interface LandFormMeta {
  provinceName: string; // BỘ CHỈ HUY QUÂN SỰ THÀNH PHỐ HẢI PHÒNG
  quanKhu: string; // QUÂN KHU 3
  periodCurrent: string; // 2026-01-01
  periodPrevious: string; // 2025-01-01
  dataSource: string; // REFERENCE_HAIPHONG_2026
  watermark: string;
}

// Một dòng số liệu tổng hợp (thửa lá hoặc dòng cộng nhóm).
interface Agg {
  pointPrev: number; areaPrev: number;
  incPoint: number; incArea: number;
  decPoint: number; decArea: number;
  pointNow: number; areaNow: number;
  areaDefense: number; areaEconomic: number; areaFamily: number;
  certPoint: number; certArea: number;
}
const zeroAgg = (): Agg => ({
  pointPrev: 0, areaPrev: 0, incPoint: 0, incArea: 0, decPoint: 0, decArea: 0,
  pointNow: 0, areaNow: 0, areaDefense: 0, areaEconomic: 0, areaFamily: 0, certPoint: 0, certArea: 0,
});
const addAgg = (t: Agg, s: Agg) => {
  t.pointPrev += s.pointPrev; t.areaPrev += s.areaPrev;
  t.incPoint += s.incPoint; t.incArea += s.incArea;
  t.decPoint += s.decPoint; t.decArea += s.decArea;
  t.pointNow += s.pointNow; t.areaNow += s.areaNow;
  t.areaDefense += s.areaDefense; t.areaEconomic += s.areaEconomic; t.areaFamily += s.areaFamily;
  t.certPoint += s.certPoint; t.certArea += s.certArea;
};

interface Leaf extends Agg {
  code: string; name: string; commune: string; province: string;
  certSerie: string | null; legalDocs: string | null; disputeStatus: string; note: string | null;
}
interface Block { code: string; name: string; leaves: Leaf[]; subtotal: Agg; }
export interface LandTree { blocks: Block[]; grand: Agg; }

function splitAddress(address: string | null): { commune: string; province: string } {
  if (!address) return { commune: '', province: '' };
  const i = address.lastIndexOf(',');
  if (i < 0) return { commune: address.trim(), province: '' };
  return { commune: address.slice(0, i).trim(), province: address.slice(i + 1).trim() };
}

// Truy vấn thửa + snapshot kỳ trước → dựng cây khối. Sắp xếp theo khối rồi mã (giữ thứ tự gốc).
export async function fetchLandTree(ds: DataSource, meta: LandFormMeta): Promise<LandTree> {
  const rows: Array<Record<string, unknown>> = await ds.query(
    `SELECT o.code AS block_code, o.name AS block_name,
            p.code, p.name, p.address, p.certificate_serie, p.legal_docs,
            p.dispute_status, p.notes,
            COALESCE(s.point_count,0) AS point_prev, COALESCE(s.area,0) AS area_prev,
            p.point_count AS point_now, p.land_area AS area_now,
            p.area_defense, p.area_economic, p.area_family,
            COALESCE(s.cert_count,0) AS cert_count, COALESCE(s.cert_area,0) AS cert_area
     FROM land_parcels p
     JOIN organizations o ON o.id = p.organization_id
     LEFT JOIN land_period_snapshots s ON s.parcel_code = p.code AND s.period_date = $2
     WHERE p.data_source = $1
     ORDER BY o.code, p.code`,
    [meta.dataSource, meta.periodPrevious],
  );

  const byBlock = new Map<string, Block>();
  const grand = zeroAgg();
  for (const r of rows) {
    const bc = String(r.block_code);
    if (!byBlock.has(bc)) byBlock.set(bc, { code: bc, name: String(r.block_name), leaves: [], subtotal: zeroAgg() });
    const block = byBlock.get(bc)!;
    const n = (v: unknown) => Number(v ?? 0);
    const pointPrev = n(r.point_prev), areaPrev = n(r.area_prev);
    const pointNow = n(r.point_now), areaNow = n(r.area_now);
    const { commune, province } = splitAddress(r.address as string | null);
    const leaf: Leaf = {
      code: String(r.code), name: String(r.name), commune, province,
      certSerie: (r.certificate_serie as string) ?? null,
      legalDocs: (r.legal_docs as string) ?? null,
      disputeStatus: String(r.dispute_status ?? 'NONE'),
      note: (r.notes as string) ?? null,
      pointPrev, areaPrev,
      incPoint: Math.max(0, pointNow - pointPrev), incArea: Math.max(0, areaNow - areaPrev),
      decPoint: Math.max(0, pointPrev - pointNow), decArea: Math.max(0, areaPrev - areaNow),
      pointNow, areaNow,
      areaDefense: n(r.area_defense), areaEconomic: n(r.area_economic), areaFamily: n(r.area_family),
      certPoint: n(r.cert_count), certArea: n(r.cert_area),
    };
    block.leaves.push(leaf);
    addAgg(block.subtotal, leaf);
    addAgg(grand, leaf);
  }
  const blocks = [...byBlock.values()].sort((a, b) => a.code.localeCompare(b.code));
  return { blocks, grand };
}

// ── Định nghĩa cột từng biểu ─────────────────────────────────────
interface Col { key: string; group?: string; width: number; num?: boolean; }
const N = (k: string, g: string | undefined, w: number) => ({ key: k, group: g, width: w, num: true });
const T = (k: string, g: string | undefined, w: number) => ({ key: k, group: g, width: w });

// Cột chung phần đầu + kỳ trước/tăng/giảm/kỳ này.
const commonHead = (withHuyen: boolean): Col[] => [
  T('stt', undefined, 5),
  T('name', undefined, 40),
  T('commune', 'Địa điểm', 16),
  ...(withHuyen ? [T('huyen', 'Địa điểm', 12)] : []),
  T('province', 'Địa điểm', 14),
  N('pointPrev', 'Số liệu kiểm kê kỳ trước', 8), N('areaPrev', 'Số liệu kiểm kê kỳ trước', 13),
  N('incPoint', 'Tăng', 7), N('incArea', 'Tăng', 12),
  N('decPoint', 'Giảm', 7), N('decArea', 'Giảm', 12),
  N('pointNow', 'Số liệu kiểm kê kỳ này', 8), N('areaNow', 'Số liệu kiểm kê kỳ này', 13),
];

const FORM_COLS: Record<LandFormVariant, { title: string; cols: Col[] }> = {
  '01': {
    title: 'BÁO CÁO TỔNG HỢP KIỂM KÊ ĐẤT QUỐC PHÒNG',
    cols: [
      ...commonHead(true),
      N('areaDefense', 'Hiện trạng sử dụng', 13),
      N('areaEconomic', 'Hiện trạng sử dụng', 12),
      N('areaFamily', 'Hiện trạng sử dụng', 12),
      N('gcnNewPoint', 'GCN cấp trong kỳ', 7), N('gcnNewArea', 'GCN cấp trong kỳ', 12),
      N('certPoint', 'GCN đến thời điểm', 7), N('certArea', 'GCN đến thời điểm', 13),
      T('note', undefined, 20),
    ],
  },
  '02': {
    title: 'BÁO CÁO KIỂM KÊ ĐẤT QUỐC PHÒNG',
    cols: [
      ...commonHead(false),
      N('certPoint', 'GCN đến thời điểm', 7),
      T('certSerie', 'GCN đến thời điểm', 22),
      N('certArea', 'GCN đến thời điểm', 13),
      T('legalDocs', undefined, 30),
      T('note', undefined, 18),
    ],
  },
  '03': {
    title: 'BÁO CÁO HIỆN TRẠNG SỬ DỤNG ĐẤT QUỐC PHÒNG',
    cols: [
      ...commonHead(false),
      N('areaDefense', 'Hiện trạng sử dụng', 13),
      N('areaEconomic', 'Hiện trạng sử dụng', 12),
      N('areaFamily', 'Hiện trạng sử dụng', 12),
      N('disputePoint', 'Đất tranh chấp, lấn chiếm', 7),
      N('disputeArea', 'Đất tranh chấp, lấn chiếm', 12),
      T('note', undefined, 18),
    ],
  },
  '04': { title: 'BÁO CÁO KIỂM KÊ ĐẤT QUỐC PHÒNG CHO THUÊ, MƯỢN, LDLK', cols: [] },
  '05': { title: 'TỔNG HỢP CÁC KHU GIA ĐÌNH ĐANG QUẢN LÝ', cols: [] },
};

const HEADER_LABELS: Record<string, string> = {
  stt: 'STT', name: 'Đơn vị sử dụng (Tên cơ sở doanh trại, đơn vị)',
  commune: 'Xã (phường)', huyen: 'Huyện (quận)', province: 'Tỉnh (TP)',
  pointPrev: 'Số điểm', areaPrev: 'Diện tích (m²)',
  incPoint: 'Số điểm', incArea: 'Diện tích (m²)',
  decPoint: 'Số điểm', decArea: 'Diện tích (m²)',
  pointNow: 'Số điểm', areaNow: 'Diện tích (m²)',
  areaDefense: 'Mục đích quốc phòng (m²)', areaEconomic: 'Mục đích kinh tế (m²)', areaFamily: 'Khu gia đình (m²)',
  gcnNewPoint: 'Số điểm', gcnNewArea: 'Diện tích (m²)',
  certPoint: 'Số điểm', certArea: 'Diện tích (m²)', certSerie: 'Ký hiệu (Serie, ngày cấp)',
  disputePoint: 'Số điểm', disputeArea: 'Diện tích (m²)',
  legalDocs: 'Hồ sơ pháp lý đất liên quan', note: 'Ghi chú',
};

// Giá trị ô cho một dòng số liệu (leaf hoặc cộng nhóm).
function cellValues(cols: Col[], stt: string, name: string, a: Agg, extra: Partial<Leaf> = {}): (string | number)[] {
  const disputePoint = extra.disputeStatus && extra.disputeStatus !== 'NONE' ? a.pointNow : 0;
  const disputeArea = extra.disputeStatus && extra.disputeStatus !== 'NONE' ? a.areaNow : 0;
  const map: Record<string, string | number> = {
    stt, name,
    commune: extra.commune ?? '', huyen: '', province: extra.province ?? '',
    pointPrev: a.pointPrev, areaPrev: a.areaPrev,
    incPoint: a.incPoint, incArea: a.incArea,
    decPoint: a.decPoint, decArea: a.decArea,
    pointNow: a.pointNow, areaNow: a.areaNow,
    areaDefense: a.areaDefense, areaEconomic: a.areaEconomic, areaFamily: a.areaFamily,
    gcnNewPoint: 0, gcnNewArea: 0,
    certPoint: a.certPoint, certArea: a.certArea, certSerie: extra.certSerie ?? '',
    disputePoint, disputeArea,
    legalDocs: extra.legalDocs ?? '', note: extra.note ?? '',
  };
  return cols.map((c) => {
    const v = map[c.key];
    if (c.num) return typeof v === 'number' ? Number(v.toFixed(2)) : 0;
    return v ?? '';
  });
}

// Viết 4 dòng tiêu đề chuẩn đầu biểu (dùng chung mọi biểu).
function writeTitle(ws: ExcelJS.Worksheet, meta: LandFormMeta, mauBieu: string, title: string, lastColLetter: string) {
  const titleRow = (text: string, bold: boolean, size: number) => {
    const r = ws.addRow([text]);
    ws.mergeCells(`A${r.number}:${lastColLetter}${r.number}`);
    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(1).font = { bold, size };
  };
  titleRow(`${meta.quanKhu} — ${meta.provinceName}`, false, 10);
  titleRow(`MẪU BIỂU SỐ: ${mauBieu}`, true, 9);
  titleRow(title, true, 13);
  titleRow(`Kiểm kê 0 giờ ngày 01 tháng 01 năm ${new Date(meta.periodCurrent).getFullYear()} · Nguồn: ${meta.dataSource} · ${meta.watermark}`, false, 8);
}

// Render workbook cho biểu 01/02/03 (cấu trúc banded chung).
export function buildLandFormWorkbook(variant: LandFormVariant, tree: LandTree, meta: LandFormMeta): ExcelJS.Workbook {
  const spec = FORM_COLS[variant];
  const cols = spec.cols;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Biểu ${variant}`, { views: [{ state: 'frozen', ySplit: 7 }] });
  const nCols = cols.length;
  const lastColLetter = ws.getColumn(nCols).letter;
  writeTitle(ws, meta, `${variant}/KK-ĐQP`, spec.title, lastColLetter);

  // Header 2 tầng: nhóm (row A) + cột con (row B). Cột không nhóm → merge dọc 2 dòng.
  const groupRowIdx = ws.rowCount + 1;
  const subRowIdx = groupRowIdx + 1;
  const numRowIdx = subRowIdx + 1;
  ws.addRow([]); ws.addRow([]); ws.addRow([]);
  for (let i = 0; i < nCols; i++) {
    const c = cols[i];
    const letter = ws.getColumn(i + 1).letter;
    const sub = ws.getCell(`${letter}${subRowIdx}`);
    sub.value = HEADER_LABELS[c.key] ?? c.key;
    if (!c.group) {
      ws.mergeCells(`${letter}${groupRowIdx}:${letter}${subRowIdx}`);
      ws.getCell(`${letter}${groupRowIdx}`).value = HEADER_LABELS[c.key] ?? c.key;
      sub.value = HEADER_LABELS[c.key] ?? c.key;
    }
    ws.getCell(`${letter}${numRowIdx}`).value = i + 1;
  }
  // Gộp ô nhóm theo các cột liền kề cùng group.
  let i = 0;
  while (i < nCols) {
    const g = cols[i].group;
    if (g) {
      let j = i;
      while (j + 1 < nCols && cols[j + 1].group === g) j++;
      const from = ws.getColumn(i + 1).letter;
      const to = ws.getColumn(j + 1).letter;
      ws.mergeCells(`${from}${groupRowIdx}:${to}${groupRowIdx}`);
      const cell = ws.getCell(`${from}${groupRowIdx}`);
      cell.value = g;
      i = j + 1;
    } else {
      i++;
    }
  }
  for (const ri of [groupRowIdx, subRowIdx, numRowIdx]) {
    const row = ws.getRow(ri);
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: ri !== numRowIdx, size: ri === numRowIdx ? 8 : 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  }

  const styleDataRow = (rowNumber: number, bold: boolean) => {
    const row = ws.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { bold, size: 9 };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      const c = cols[colNumber - 1];
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: c?.num ? 'right' : colNumber <= 2 ? 'left' : 'center' };
      if (c?.num) cell.numFmt = '#,##0.0';
    });
  };

  // Dòng tổng toàn TP (A+B+C+D+E).
  const grandRow = ws.addRow(cellValues(cols, '', `${meta.provinceName.replace(/^BỘ CHỈ HUY QUÂN SỰ /, '')} (A+B+C+D+E)`, tree.grand));
  styleDataRow(grandRow.number, true);

  // Từng khối: dòng cộng khối + các thửa lá.
  for (const block of tree.blocks) {
    const blockRow = ws.addRow(cellValues(cols, block.code, block.name, block.subtotal));
    styleDataRow(blockRow.number, true);
    let stt = 1;
    for (const leaf of block.leaves) {
      const r = ws.addRow(cellValues(cols, String(stt++), leaf.name, leaf, leaf));
      styleDataRow(r.number, false);
    }
  }

  cols.forEach((c, idx) => { ws.getColumn(idx + 1).width = c.width; });
  return wb;
}

// Bản phẳng (grand → khối → thửa) cho PDF/Word — tái dùng buildPdf/buildRtf sẵn có.
export function flattenLandForm(
  variant: LandFormVariant,
  tree: LandTree,
  meta: LandFormMeta,
): { title: string; columns: Array<{ key: string; header: string }>; rows: Record<string, unknown>[] } {
  const spec = FORM_COLS[variant];
  const cols = spec.cols;
  const columns = cols.map((c) => ({
    key: c.key,
    header: c.group ? `${c.group} · ${HEADER_LABELS[c.key] ?? c.key}` : HEADER_LABELS[c.key] ?? c.key,
  }));
  const toRow = (vals: (string | number)[]) => {
    const o: Record<string, unknown> = {};
    cols.forEach((c, i) => { o[c.key] = vals[i]; });
    return o;
  };
  const rows: Record<string, unknown>[] = [];
  rows.push(toRow(cellValues(cols, '', `${meta.provinceName.replace(/^BỘ CHỈ HUY QUÂN SỰ /, '')} (A+B+C+D+E)`, tree.grand)));
  for (const block of tree.blocks) {
    rows.push(toRow(cellValues(cols, block.code, block.name, block.subtotal)));
    let stt = 1;
    for (const leaf of block.leaves) rows.push(toRow(cellValues(cols, String(stt++), leaf.name, leaf, leaf)));
  }
  return { title: `${spec.title} (${variant}/KK-ĐQP)`, columns, rows };
}

// ── Biểu 04/KK-ĐQP — Đất QP cho thuê/mượn/LDLK ─────────────────
export interface EconRow {
  category: string; name: string; commune: string; province: string; area: number;
  tt35Duyet: number; tt35Chu: number; tt58Duyet: number; tt58Chu: number;
  hdBqpTt: number; hdBqpCv: number; tuKy: number; certSerie: string | null; note: string | null;
}
const CAT_LABEL: Record<string, string> = { ACTIVE: 'HỢP ĐỒNG CÒN THỜI HẠN', LIQUIDATED: 'HỢP ĐỒNG ĐÃ THANH LÝ CHƯA THU HỒI ĐẤT' };

export async function fetchEconomicRows(ds: DataSource, meta: LandFormMeta): Promise<EconRow[]> {
  const rows: Array<Record<string, unknown>> = await ds.query(
    `SELECT e.area, e.legal_basis, e.bqp_status, e.certificate_serie, e.note, p.name, p.address
     FROM land_economic_use e JOIN land_parcels p ON p.id = e.land_parcel_id
     WHERE p.data_source = $1
     ORDER BY e.created_at`,
    [meta.dataSource],
  );
  return rows.map((r) => {
    const area = Number(r.area ?? 0);
    const basis = String(r.legal_basis);
    const bqp = String(r.bqp_status);
    const note = (r.note as string) ?? '';
    const category = note.includes('thanh lý') ? 'LIQUIDATED' : 'ACTIVE';
    const { commune, province } = splitAddress(r.address as string | null);
    return {
      category, name: String(r.name), commune, province, area,
      tt35Duyet: basis === 'TT35_2009' && bqp === 'PHE_DUYET' ? area : 0,
      tt35Chu: basis === 'TT35_2009' && bqp === 'CHU_TRUONG' ? area : 0,
      tt58Duyet: basis === 'TT58_2021' && bqp === 'PHE_DUYET' ? area : 0,
      tt58Chu: basis === 'TT58_2021' && bqp === 'CHU_TRUONG' ? area : 0,
      hdBqpTt: basis === 'HD_BQP_TT' ? area : 0,
      hdBqpCv: basis === 'HD_BQP_CV' ? area : 0,
      tuKy: basis === 'TU_KY' ? area : 0,
      certSerie: (r.certificate_serie as string) ?? null,
      note: (r.note as string) ?? null,
    };
  });
}

const ECON_COLS: Col[] = [
  T('stt', undefined, 5), T('name', undefined, 40),
  T('commune', 'Địa chỉ', 16), T('province', 'Địa chỉ', 14),
  N('area', undefined, 13),
  N('tt35Duyet', 'TT 35/2009', 12), N('tt35Chu', 'TT 35/2009', 12),
  N('tt58Duyet', 'TT 58/2021', 12), N('tt58Chu', 'TT 58/2021', 12),
  N('hdBqpTt', undefined, 12), N('hdBqpCv', undefined, 12), N('tuKy', undefined, 12),
  T('certSerie', undefined, 18), T('note', undefined, 18),
];
const ECON_LABELS: Record<string, string> = {
  stt: 'STT', name: 'Đơn vị sử dụng (Tên cơ sở, vị trí)', commune: 'Xã (phường)', province: 'Tỉnh (TP)',
  area: 'Diện tích kiểm kê (m²)', tt35Duyet: 'Đã duyệt phương án', tt35Chu: 'Có chủ trương',
  tt58Duyet: 'Đã duyệt phương án', tt58Chu: 'Có chủ trương',
  hdBqpTt: 'HĐ với BQP theo TT (m²)', hdBqpCv: 'HĐ với BQP theo CV (m²)', tuKy: 'Đơn vị tự ký HĐ (m²)',
  certSerie: 'GCNQSDĐ (Serie, ngày)', note: 'Ghi chú',
};

function econSum(rows: EconRow[]): number[] {
  const keys = ['area', 'tt35Duyet', 'tt35Chu', 'tt58Duyet', 'tt58Chu', 'hdBqpTt', 'hdBqpCv', 'tuKy'] as const;
  return keys.map((k) => rows.reduce((s, r) => s + (r[k] as number), 0));
}

export function buildEconomicWorkbook(rows: EconRow[], meta: LandFormMeta): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Biểu 04', { views: [{ state: 'frozen', ySplit: 7 }] });
  const nCols = ECON_COLS.length;
  const lastCol = ws.getColumn(nCols).letter;
  writeTitle(ws, meta, '04/KK-ĐQP', 'BÁO CÁO KIỂM KÊ ĐẤT QUỐC PHÒNG CHO THUÊ, MƯỢN, LDLK', lastCol);

  const groupRowIdx = ws.rowCount + 1;
  const subRowIdx = groupRowIdx + 1;
  ws.addRow([]); ws.addRow([]);
  for (let i = 0; i < nCols; i++) {
    const c = ECON_COLS[i];
    const letter = ws.getColumn(i + 1).letter;
    ws.getCell(`${letter}${subRowIdx}`).value = ECON_LABELS[c.key] ?? c.key;
    if (!c.group) {
      ws.mergeCells(`${letter}${groupRowIdx}:${letter}${subRowIdx}`);
      ws.getCell(`${letter}${groupRowIdx}`).value = ECON_LABELS[c.key] ?? c.key;
    }
  }
  let gi = 0;
  while (gi < nCols) {
    const g = ECON_COLS[gi].group;
    if (g) {
      let j = gi; while (j + 1 < nCols && ECON_COLS[j + 1].group === g) j++;
      ws.mergeCells(`${ws.getColumn(gi + 1).letter}${groupRowIdx}:${ws.getColumn(j + 1).letter}${groupRowIdx}`);
      ws.getCell(`${ws.getColumn(gi + 1).letter}${groupRowIdx}`).value = g;
      gi = j + 1;
    } else gi++;
  }
  for (const ri of [groupRowIdx, subRowIdx]) {
    ws.getRow(ri).eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  }
  const style = (rn: number, bold: boolean) => {
    ws.getRow(rn).eachCell({ includeEmpty: true }, (cell, cn) => {
      const c = ECON_COLS[cn - 1];
      cell.font = { bold, size: 9 };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: c?.num ? 'right' : cn <= 2 ? 'left' : 'center' };
      if (c?.num) cell.numFmt = '#,##0.0';
    });
  };
  const rowVals = (stt: string, name: string, r: Partial<EconRow>) =>
    ECON_COLS.map((c) => {
      const v = (r as Record<string, unknown>)[c.key];
      if (c.key === 'stt') return stt;
      if (c.key === 'name') return name;
      if (c.num) return typeof v === 'number' ? Number(v.toFixed(2)) : 0;
      return (v as string) ?? '';
    });

  // Tổng cộng toàn tỉnh.
  const [tArea, t35d, t35c, t58d, t58c, tHt, tHc, tTk] = econSum(rows);
  const grand = ws.addRow(rowVals('', 'BỘ CHQS THÀNH PHỐ HẢI PHÒNG', { area: tArea, tt35Duyet: t35d, tt35Chu: t35c, tt58Duyet: t58d, tt58Chu: t58c, hdBqpTt: tHt, hdBqpCv: tHc, tuKy: tTk }));
  style(grand.number, true);

  for (const cat of ['ACTIVE', 'LIQUIDATED']) {
    const sub = rows.filter((r) => r.category === cat);
    if (!sub.length) continue;
    const [sa, s35d, s35c, s58d, s58c, sht, shc, stk] = econSum(sub);
    const catRow = ws.addRow(rowVals('', CAT_LABEL[cat], { area: sa, tt35Duyet: s35d, tt35Chu: s35c, tt58Duyet: s58d, tt58Chu: s58c, hdBqpTt: sht, hdBqpCv: shc, tuKy: stk }));
    style(catRow.number, true);
    let stt = 1;
    for (const r of sub) { const rr = ws.addRow(rowVals(String(stt++), r.name, r)); style(rr.number, false); }
  }
  ECON_COLS.forEach((c, idx) => { ws.getColumn(idx + 1).width = c.width; });
  return wb;
}

// ── Biểu 01/KK-KGĐ — Khu gia đình đang quản lý ─────────────────
export interface FamilyRow {
  code: string; name: string; address: string; totalArea: number; households: number;
  legalDoc: string | null; notHandedReason: string | null; plannedHandover: string | null; note: string | null;
}
export async function fetchFamilyRows(ds: DataSource, meta: LandFormMeta): Promise<FamilyRow[]> {
  const rows: Array<Record<string, unknown>> = await ds.query(
    `SELECT h.code, h.name, h.address, h.total_area, h.household_count,
            h.legal_doc, h.not_handed_reason, h.planned_handover, h.note
     FROM family_housing_areas h WHERE h.data_source = $1 ORDER BY h.code`,
    [meta.dataSource],
  );
  return rows.map((r) => ({
    code: String(r.code), name: String(r.name), address: (r.address as string) ?? '',
    totalArea: Number(r.total_area ?? 0), households: Number(r.household_count ?? 0),
    legalDoc: (r.legal_doc as string) ?? null, notHandedReason: (r.not_handed_reason as string) ?? null,
    plannedHandover: (r.planned_handover as string) ?? null, note: (r.note as string) ?? null,
  }));
}

const FAMILY_COLS: Array<{ key: keyof FamilyRow | 'stt'; header: string; width: number; num?: boolean }> = [
  { key: 'stt', header: 'STT', width: 5 },
  { key: 'name', header: 'Tên khu gia đình', width: 34 },
  { key: 'address', header: 'Địa chỉ (xã, huyện, tỉnh)', width: 26 },
  { key: 'totalArea', header: 'Tổng diện tích khu đất (m²)', width: 15, num: true },
  { key: 'households', header: 'Số hộ gia đình', width: 12, num: true },
  { key: 'legalDoc', header: 'Hồ sơ pháp lý hình thành', width: 26 },
  { key: 'notHandedReason', header: 'Lý do chưa bàn giao địa phương', width: 26 },
  { key: 'plannedHandover', header: 'Dự kiến thời gian bàn giao', width: 16 },
  { key: 'note', header: 'Ghi chú', width: 16 },
];

export function buildFamilyWorkbook(rows: FamilyRow[], meta: LandFormMeta): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Biểu 05', { views: [{ state: 'frozen', ySplit: 6 }] });
  const nCols = FAMILY_COLS.length;
  const lastCol = ws.getColumn(nCols).letter;
  writeTitle(ws, meta, '01/KK-KGĐ', 'TỔNG HỢP CÁC KHU GIA ĐÌNH ĐANG QUẢN LÝ, CHƯA BÀN GIAO ĐỊA PHƯƠNG', lastCol);
  const headRow = ws.addRow(FAMILY_COLS.map((c) => c.header));
  headRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  });
  const style = (rn: number, bold: boolean) => {
    ws.getRow(rn).eachCell({ includeEmpty: true }, (cell, cn) => {
      const c = FAMILY_COLS[cn - 1];
      cell.font = { bold, size: 9 };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.alignment = { vertical: 'top', wrapText: true, horizontal: c?.num ? 'right' : cn === 1 ? 'center' : 'left' };
      if (c?.num) cell.numFmt = '#,##0.0';
    });
  };
  const totalArea = rows.reduce((s, r) => s + r.totalArea, 0);
  const totalHouse = rows.reduce((s, r) => s + r.households, 0);
  const totalRow = ws.addRow(['', 'TỔNG CỘNG', '', Number(totalArea.toFixed(2)), totalHouse, '', '', '', '']);
  style(totalRow.number, true);
  let stt = 1;
  for (const r of rows) {
    const vals = FAMILY_COLS.map((c) => {
      if (c.key === 'stt') return String(stt);
      const v = r[c.key as keyof FamilyRow];
      if (c.num) return typeof v === 'number' ? Number(v.toFixed(2)) : 0;
      return (v as string) ?? '';
    });
    stt++;
    const rr = ws.addRow(vals);
    style(rr.number, false);
  }
  FAMILY_COLS.forEach((c, idx) => { ws.getColumn(idx + 1).width = c.width; });
  return wb;
}

// Bản phẳng biểu 04 (PDF/Word).
export function flattenEconomic(rows: EconRow[], meta: LandFormMeta) {
  const columns = ECON_COLS.map((c) => ({ key: c.key, header: c.group ? `${c.group} · ${ECON_LABELS[c.key]}` : ECON_LABELS[c.key] ?? c.key }));
  const out: Record<string, unknown>[] = [];
  const [tArea, t35d, t35c, t58d, t58c, tHt, tHc, tTk] = econSum(rows);
  out.push({ stt: '', name: 'BỘ CHQS THÀNH PHỐ HẢI PHÒNG', area: tArea, tt35Duyet: t35d, tt35Chu: t35c, tt58Duyet: t58d, tt58Chu: t58c, hdBqpTt: tHt, hdBqpCv: tHc, tuKy: tTk });
  for (const cat of ['ACTIVE', 'LIQUIDATED']) {
    const sub = rows.filter((r) => r.category === cat);
    if (!sub.length) continue;
    out.push({ stt: '', name: CAT_LABEL[cat] });
    let stt = 1;
    for (const r of sub) out.push({ ...r, stt: String(stt++) });
  }
  return { title: 'BÁO CÁO ĐẤT QP CHO THUÊ, MƯỢN, LDLK (04/KK-ĐQP)', columns, rows: out };
}

// Bản phẳng biểu 05 (PDF/Word).
export function flattenFamily(rows: FamilyRow[], _meta: LandFormMeta) {
  const columns = FAMILY_COLS.map((c) => ({ key: String(c.key), header: c.header }));
  const totalArea = rows.reduce((s, r) => s + r.totalArea, 0);
  const totalHouse = rows.reduce((s, r) => s + r.households, 0);
  const out: Record<string, unknown>[] = [{ stt: '', name: 'TỔNG CỘNG', totalArea, households: totalHouse }];
  let stt = 1;
  for (const r of rows) out.push({ ...r, stt: String(stt++) });
  return { title: 'TỔNG HỢP CÁC KHU GIA ĐÌNH ĐANG QUẢN LÝ (01/KK-KGĐ)', columns, rows: out };
}

export const LAND_FORM_TEMPLATES: Record<string, { title: string; variant: LandFormVariant; columns: string[] }> = {
  'bcqk-01-tong-hop-dat-qp': { title: 'Biểu 01/KK-ĐQP — Báo cáo tổng hợp kiểm kê đất quốc phòng', variant: '01', columns: ['STT', 'Đơn vị', 'Địa điểm', 'Kỳ trước', 'Tăng', 'Giảm', 'Kỳ này', 'Hiện trạng', 'GCNQSDĐ', 'Ghi chú'] },
  'bcqk-02-kiem-ke-dat-qp': { title: 'Biểu 02/KK-ĐQP — Báo cáo kiểm kê đất quốc phòng', variant: '02', columns: ['STT', 'Đơn vị', 'Địa chỉ', 'Kỳ trước', 'Tăng', 'Giảm', 'Kỳ này', 'GCNQSDĐ', 'Hồ sơ pháp lý', 'Ghi chú'] },
  'bcqk-03-hien-trang-dat-qp': { title: 'Biểu 03/KK-ĐQP — Báo cáo hiện trạng sử dụng đất quốc phòng', variant: '03', columns: ['STT', 'Đơn vị', 'Địa chỉ', 'Kỳ trước', 'Tăng', 'Giảm', 'Kỳ này', 'Hiện trạng', 'Tranh chấp/lấn chiếm', 'Ghi chú'] },
  'bcqk-04-dat-qp-kinh-te': { title: 'Biểu 04/KK-ĐQP — Đất QP cho thuê, mượn, LDLK', variant: '04', columns: ['STT', 'Đơn vị', 'Địa chỉ', 'DT kiểm kê', 'TT 35/2009', 'TT 58/2021', 'HĐ BQP', 'Tự ký', 'GCNQSDĐ', 'Ghi chú'] },
  'bcqk-05-khu-gia-dinh': { title: 'Biểu 01/KK-KGĐ — Khu gia đình đang quản lý, chưa bàn giao', variant: '05', columns: ['STT', 'Tên khu', 'Địa chỉ', 'Diện tích', 'Số hộ', 'Hồ sơ pháp lý', 'Lý do chưa bàn giao', 'Dự kiến bàn giao', 'Ghi chú'] },
};
