// Parser Excel cho bộ biểu BCQK Đất Quốc phòng (import land-parcels).
// Đọc sheet "2. BC KIỂM KÊ ĐQP": bỏ header + dòng cộng (khối/ngành/tổng), gộp diện tích
// các dòng continuation (thửa merged nhiều dòng vật lý), chỉ lấy THỬA LÁ.
// ExcelJS trả giá trị MASTER cho ô merged → phát hiện continuation qua master.row !== r.
import * as ExcelJS from 'exceljs';

export interface StagedLandParcel {
  block: string;
  name: string;
  commune: string | null;
  province: string;
  pointPrev: number;
  areaPrev: number;
  pointNow: number;
  areaNow: number;
  certSerie: string | null;
  legalDocs: string | null;
  note: string | null;
  __sourceRow: number;
}

export interface LandParseResult {
  blocks: Array<{ code: string; name: string }>;
  leaves: StagedLandParcel[];
  sheetName: string;
}

// Vị trí cột theo mẫu chuẩn sheet 2 (1-based).
const COL = { stt: 1, name: 2, commune: 3, province: 4, pointPrev: 5, areaPrev: 6, pointNow: 11, areaNow: 12, certSerie: 14, legalDocs: 16, note: 17 };

const num = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'result' in v) return num((v as { result: unknown }).result);
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isNaN(n) ? 0 : n;
};
const txt = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'object' && v !== null) {
    if ('result' in v) return txt((v as { result: unknown }).result);
    if ('richText' in v) return ((v as { richText: Array<{ text: string }> }).richText.map((t) => t.text).join('')).trim() || null;
    if ('text' in v) return String((v as { text: unknown }).text).trim() || null;
  }
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s || null;
};
const isIntStr = (s: string | null) => !!s && /^[0-9]+$/.test(s);

// Giá trị RIÊNG của ô: nếu ô là merged non-master, giá trị thuộc ô master (đã tính ở dòng trên)
// → trả 0 để không cộng lặp. Nếu không merged hoặc là master → trả số của ô.
function ownNum(cell: ExcelJS.Cell): number {
  if (cell.isMerged && cell.master.address !== cell.address) return 0;
  return num(cell.value);
}

function pickSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  const byName = wb.worksheets.find((w) => /KIỂM KÊ ĐQP/i.test(w.name) || /02\/?KK/i.test(w.name));
  return byName ?? wb.worksheets.find((w) => /ĐQP/i.test(w.name)) ?? wb.worksheets[0];
}

// Đọc buffer .xlsx → danh sách thửa lá + khối. Không ghi DB (chỉ staging/parse).
export async function parseLandParcelsWorkbook(buffer: Buffer): Promise<LandParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = pickSheet(wb);

  // Tìm dòng tổng "(A+B+C+D+E)" để xác định điểm bắt đầu vùng dữ liệu (sau header).
  let start = 9;
  for (let r = 1; r <= Math.min(ws.rowCount, 30); r++) {
    if ((txt(ws.getCell(r, COL.name).value) ?? '').includes('(A+B+C+D+E)')) { start = r + 1; break; }
  }

  const blocks: Array<{ code: string; name: string }> = [];
  const leaves: StagedLandParcel[] = [];
  let curBlock: string | null = null;
  let cur: StagedLandParcel | null = null;

  for (let r = start; r <= ws.rowCount; r++) {
    const sttCell = ws.getCell(r, COL.stt);
    const isContinuation = sttCell.isMerged && sttCell.master.address !== sttCell.address;
    const stt = txt(sttCell.value);
    const name = txt(ws.getCell(r, COL.name).value);
    const pointPrevRaw = ws.getCell(r, COL.pointPrev).value;
    const areaPrev = num(ws.getCell(r, COL.areaPrev).value);
    const areaNow = num(ws.getCell(r, COL.areaNow).value);

    if (isContinuation) {
      // Chỉ cộng diện tích RIÊNG của dòng con (nếu ô diện tích cũng merged thì giá trị đã tính ở master).
      if (cur) {
        cur.areaPrev += ownNum(ws.getCell(r, COL.areaPrev));
        cur.areaNow += ownNum(ws.getCell(r, COL.areaNow));
      }
      continue;
    }
    if (stt && ['A', 'B', 'C', 'D', 'E'].includes(stt)) {
      curBlock = stt;
      blocks.push({ code: stt, name: name ?? `Khối ${stt}` });
      cur = null;
      continue;
    }
    if (stt === '*') { cur = null; continue; }
    // Dòng cộng ngành/tổng: không có STT nhưng có số điểm ở cột "kỳ trước".
    if (!stt && pointPrevRaw != null) { cur = null; continue; }
    if (isIntStr(stt)) {
      cur = {
        block: curBlock ?? '?',
        name: name ?? `Thửa ${stt}`,
        commune: txt(ws.getCell(r, COL.commune).value),
        province: txt(ws.getCell(r, COL.province).value) ?? '',
        pointPrev: Math.trunc(num(pointPrevRaw)),
        areaPrev,
        pointNow: Math.trunc(num(ws.getCell(r, COL.pointNow).value)),
        areaNow,
        certSerie: txt(ws.getCell(r, COL.certSerie).value),
        legalDocs: txt(ws.getCell(r, COL.legalDocs).value),
        note: txt(ws.getCell(r, COL.note).value),
        __sourceRow: r,
      };
      leaves.push(cur);
    }
    // dòng khác (chữ ký, ghi chú cuối) → bỏ qua.
  }
  return { blocks, leaves, sheetName: ws.name };
}
