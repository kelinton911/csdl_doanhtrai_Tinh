import * as ExcelJS from 'exceljs';

// Parser file định mức (BR-DT07-026): đọc .xlsx (exceljs) hoặc .csv → dòng staging.
// Cột: materialCatalogId | semanticParam | valueNumeric | rawValue | unitId.
// Nhận diện header (tên cột) không phân biệt hoa/thường/dấu; nếu không có header → theo vị trí.

export interface NormImportRow {
  materialCatalogId: string;
  semanticParam: string;
  valueNumeric?: number;
  rawValue?: string;
  unitId?: string;
}

type Field = 'material' | 'semantic' | 'value' | 'raw' | 'unit';

const HEADER_ALIASES: Record<string, Field> = {
  materialcatalogid: 'material',
  material: 'material',
  mavatchat: 'material',
  semanticparam: 'semantic',
  semantic: 'semantic',
  ngunghia: 'semantic',
  valuenumeric: 'value',
  value: 'value',
  giatri: 'value',
  rawvalue: 'raw',
  raw: 'raw',
  giatrigoc: 'raw',
  unitid: 'unit',
  unit: 'unit',
  dvt: 'unit',
};

const POSITIONAL: Field[] = ['material', 'semantic', 'value', 'raw', 'unit'];

function normKey(s: string): string {
  return s.toLowerCase().replace(/[\s_\-.]/g, '');
}

function toRow(map: Partial<Record<Field, string>>): NormImportRow | null {
  const materialCatalogId = (map.material ?? '').trim();
  const semanticParam = (map.semantic ?? '').trim();
  if (!materialCatalogId || !semanticParam) return null;
  const valueRaw = (map.value ?? '').trim();
  const value = valueRaw === '' ? undefined : Number(valueRaw);
  return {
    materialCatalogId,
    semanticParam,
    valueNumeric: value !== undefined && !Number.isNaN(value) ? value : undefined,
    rawValue: (map.raw ?? '').trim() || undefined,
    unitId: (map.unit ?? '').trim() || undefined,
  };
}

// Từ mảng ô của 1 dòng + bản đồ cột → NormImportRow.
function rowFromCells(cells: string[], layout: Partial<Record<number, Field>> | null): NormImportRow | null {
  const map: Partial<Record<Field, string>> = {};
  if (layout) {
    for (const [idxStr, field] of Object.entries(layout)) {
      if (field) map[field] = cells[Number(idxStr)] ?? '';
    }
  } else {
    POSITIONAL.forEach((field, i) => (map[field] = cells[i] ?? ''));
  }
  return toRow(map);
}

// Xác định layout cột từ hàng đầu (nếu là header) — trả {colIndex→field} hoặc null nếu không phải header.
function detectHeader(cells: string[]): Partial<Record<number, Field>> | null {
  const layout: Partial<Record<number, Field>> = {};
  let matches = 0;
  cells.forEach((c, i) => {
    const f = HEADER_ALIASES[normKey(c)];
    if (f) {
      layout[i] = f;
      matches++;
    }
  });
  return matches >= 2 ? layout : null; // cần ≥2 cột nhận diện để coi là header
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown; richText?: Array<{ text: string }> };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join('');
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    return '';
  }
  return String(v);
}

async function parseXlsx(buffer: Buffer): Promise<NormImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const matrix: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // eachCell với includeEmpty để giữ đúng chỉ số cột (1-based → 0-based).
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell.value);
    });
    matrix.push(cells);
  });
  if (matrix.length === 0) return [];

  const layout = detectHeader(matrix[0]);
  const dataRows = layout ? matrix.slice(1) : matrix;
  return dataRows.map((r) => rowFromCells(r, layout)).filter((r): r is NormImportRow => r !== null);
}

function parseCsv(buffer: Buffer): NormImportRow[] {
  const lines = buffer
    .toString('utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (lines.length === 0) return [];
  const first = lines[0].split(',').map((c) => c.trim());
  const layout = detectHeader(first);
  const dataLines = layout ? lines.slice(1) : lines;
  return dataLines
    .map((l) => rowFromCells(l.split(',').map((c) => c.trim()), layout))
    .filter((r): r is NormImportRow => r !== null);
}

export async function parseNormsWorkbook(buffer: Buffer, filename: string): Promise<NormImportRow[]> {
  if (/\.csv$/i.test(filename)) return parseCsv(buffer);
  return parseXlsx(buffer);
}
