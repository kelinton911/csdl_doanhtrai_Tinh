// Hàm thuần dẫn xuất cấu trúc cây từ mã tài sản ngành Doanh trại.
// Dùng chung bởi seeder (nạp phụ lục) và bộ cấp mã đề xuất (P4).
// Mọi hàm ở đây KHÔNG chạm DB để test được bằng Jest.
//
// Định dạng mã: R##.##.##.##.##.###  — 6 đoạn.
//   đoạn 0 mang tiền tố 'R' và rộng 2 chữ số; đoạn 1..4 rộng 2; đoạn 5 rộng 3.

export const CODE_RE = /^R\d{2}(?:\.\d{2}){4}\.\d{3}$/;

/** Bề rộng chữ số của từng đoạn — đoạn cuối 3 chữ số, còn lại 2. */
export function segmentWidth(index: number): number {
  return index === 5 ? 3 : 2;
}

/**
 * Giá trị "canh gác" của đoạn: 99 (hoặc 999) là mã dành riêng cho
 * "Các loại khác"/"khác" trong phụ lục — không được cấp cho mục mới.
 */
export function sentinelValue(index: number): number {
  return index === 5 ? 999 : 99;
}

/** Tách mã thành 6 đoạn số dạng chuỗi (bỏ tiền tố 'R'). */
export function splitSegments(code: string): string[] {
  const parts = code.split('.');
  return [parts[0].slice(1), ...parts.slice(1)];
}

export function joinSegments(segments: string[]): string {
  return `R${segments[0]}.${segments.slice(1).join('.')}`;
}

/**
 * Cấp của mã = vị trí (1-based) của đoạn khác 0 cuối cùng.
 * Nút gốc R00.00.00.00.00.000 có cấp 0.
 *
 * KHÔNG dùng giá trị này để suy ra chương: chương nằm ở hai độ sâu mã khác nhau
 * (chương I–XIII ở đoạn thứ 3, chương XIV–XVIII ở đoạn đầu). Dùng chapterOf().
 */
export function levelOf(code: string): number {
  const segments = splitSegments(code);
  let level = 0;
  segments.forEach((segment, index) => {
    if (parseInt(segment, 10) !== 0) level = index + 1;
  });
  return level;
}

/** Mã cha — zero hoá đoạn khác 0 cuối cùng. NULL ở nút gốc. */
export function parentOf(code: string): string | null {
  const level = levelOf(code);
  if (level === 0) return null;
  const segments = splitSegments(code);
  segments[level - 1] = '0'.repeat(segmentWidth(level - 1));
  const parent = joinSegments(segments);
  return parent === code ? null : parent;
}

/** Chuỗi tổ tiên từ gốc tới ngay trên `code` (không gồm chính nó). */
export function ancestorsOf(code: string): string[] {
  const chain: string[] = [];
  let current = parentOf(code);
  while (current) {
    chain.unshift(current);
    current = parentOf(current);
  }
  return chain;
}

/**
 * Bỏ dấu tiếng Việt + hạ chữ thường, để tìm "bom" ra "bơm".
 * Tính sẵn lúc nạp nên không cần extension unaccent/pg_trgm của PostgreSQL.
 */
export function toSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rút số La Mã đứng đầu tên chương, vd "I/ Đất Quốc phòng" → "I". */
export function romanPrefix(name: string): string | null {
  const match = /^([IVX]+)\s*[/.]/.exec(name.trim());
  return match ? match[1] : null;
}

/** Chương I–IV và XVII là đất/nhà/vật kiến trúc → thuộc miền công trình. */
const FACILITY_CHAPTERS = new Set(['I', 'II', 'III', 'IV', 'XVII']);

export type AssetDomain = 'FACILITY' | 'MATERIAL' | 'ROOT' | 'UNCLASSIFIED';

export function domainOf(chapter: string | null, isRoot: boolean): AssetDomain {
  if (isRoot) return 'ROOT';
  if (!chapter) return 'UNCLASSIFIED';
  return FACILITY_CHAPTERS.has(chapter) ? 'FACILITY' : 'MATERIAL';
}

export interface RawAssetRow {
  stt: number | null;
  code: string;
  name: string;
  unitRaw: string | null;
}

export interface DerivedAssetNode extends RawAssetRow {
  parentCode: string | null;
  level: number;
  path: string;
  pathNames: string;
  isLeaf: boolean;
  childCount: number;
  unitOnGroup: boolean;
  chapter: string | null;
  chapterName: string | null;
  domain: AssetDomain;
  searchText: string;
  duplicateGroup: string | null;
}

/**
 * Dẫn xuất toàn bộ cấu trúc cây từ danh sách 4 cột thô của phụ lục.
 * Đầu vào KHÔNG cần sắp xếp sẵn — hàm tự sắp theo mã (thứ tự này trùng
 * đúng thứ tự tài liệu, nên cha luôn đứng trước con).
 */
export function deriveTree(rows: RawAssetRow[]): DerivedAssetNode[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const childCount = new Map<string, number>();
  for (const row of rows) {
    const parent = parentOf(row.code);
    if (parent) childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
  }

  // Sắp theo mã: cha luôn đứng trước con nên tính path/pathNames được trong một lượt.
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code));

  const pathByCode = new Map<string, string>();
  const namesByCode = new Map<string, string>();
  const chapterByCode = new Map<string, { chapter: string | null; name: string | null }>();

  const derived: DerivedAssetNode[] = sorted.map((row) => {
    const parentCode = parentOf(row.code);
    const level = levelOf(row.code);
    const isRoot = level === 0;

    const parentPath = parentCode ? (pathByCode.get(parentCode) ?? '') : '';
    const path = parentPath ? `${parentPath}/${row.code}` : row.code;
    pathByCode.set(row.code, path);

    const parentNames = parentCode ? (namesByCode.get(parentCode) ?? '') : '';
    const pathNames = parentNames ? `${parentNames} › ${row.name}` : row.name;
    namesByCode.set(row.code, pathNames);

    // Chương: nếu chính nút mang tiền tố La Mã thì nó LÀ gốc chương;
    // nếu không thì kế thừa của cha (duyệt ngược tổ tiên đã được ghi nhớ).
    const own = romanPrefix(row.name);
    const inherited = parentCode
      ? (chapterByCode.get(parentCode) ?? { chapter: null, name: null })
      : { chapter: null, name: null };
    const chapterInfo = own ? { chapter: own, name: row.name } : inherited;
    chapterByCode.set(row.code, chapterInfo);

    const count = childCount.get(row.code) ?? 0;

    return {
      ...row,
      parentCode,
      level,
      path,
      pathNames,
      isLeaf: count === 0,
      childCount: count,
      // Nút vừa có ĐVT vừa có con — nguy cơ cộng trùng khi tổng hợp.
      unitOnGroup: !!row.unitRaw && count > 0,
      chapter: chapterInfo.chapter,
      chapterName: chapterInfo.name,
      domain: domainOf(chapterInfo.chapter, isRoot),
      searchText: toSearchText(row.name),
      duplicateGroup: null,
    };
  });

  // Đánh dấu các nút TRÙNG TÊN GIỮA CÁC CHƯƠNG KHÁC NHAU — trường hợp thật sự gây
  // nhầm khi khai báo, điển hình là R13.01.* (chương XV) trùng 42 tên với
  // R06.04.01.* (chương XIV).
  //
  // KHÔNG đánh dấu các tên bao chung ("Các loại khác", "… khác"): chúng lặp lại theo
  // đúng thiết kế của phụ lục (121 dòng) và đã được phân biệt bằng pathNames — gắn cờ
  // sẽ chỉ tạo nhiễu, làm người dùng bỏ qua cả những cảnh báo thật.
  const byName = new Map<string, DerivedAssetNode[]>();
  for (const node of derived) {
    if (/khac/.test(node.searchText)) continue;
    const list = byName.get(node.searchText);
    if (list) list.push(node);
    else byName.set(node.searchText, [node]);
  }
  for (const [searchText, group] of byName) {
    if (group.length < 2) continue;
    const distinctChapters = new Set(group.map((n) => n.chapter));
    if (distinctChapters.size < 2) continue;
    for (const node of group) node.duplicateGroup = searchText;
  }

  void byCode;
  return derived;
}

export interface AllocatedCode {
  code: string;
  /** Đoạn (0-based) mà các nút con của nhánh này biến thiên. */
  segmentIndex: number;
  /**
   * 'siblings'     — suy từ các con hiện có, chắc chắn đúng quy ước của nhánh.
   * 'parent-level' — nhánh chưa có con nào, đặt ở đoạn ngay sau cấp của cha.
   *                  Đây là SUY ĐOÁN cấu trúc; giao diện phải cảnh báo người dùng.
   */
  inferredFrom: 'siblings' | 'parent-level';
}

/**
 * Cấp mã kế tiếp cho một mục đề xuất bổ sung dưới `parentCode`.
 *
 * QUAN TRỌNG: đoạn mà các con biến thiên KHÔNG phải lúc nào cũng là `levelOf(parent)`.
 * Phụ lục có chỗ nhảy cấp — vd cha 'R00.00.07.07.00.000' (cấp 4) nhưng các con là
 * 'R00.00.07.07.00.001'… (biến thiên ở đoạn 5, tức cấp 6). Vì vậy phải SUY TỪ CÁC CON
 * HIỆN CÓ, chỉ khi nhánh trống mới lùi về đoạn ngay sau cấp cha.
 *
 * `siblingCodes` là các mã con hiện có của `parentCode` (từ phụ lục + các đề xuất
 * đã cấp mã) — bộ gọi có trách nhiệm truyền đủ để tránh cấp trùng.
 */
export function allocateChildCode(
  parentCode: string,
  siblingCodes: string[],
): AllocatedCode {
  const parentLevel = levelOf(parentCode);
  if (parentLevel >= 6) {
    throw new Error(
      `Mã ${parentCode} đã ở cấp cuối (6) — không thể thêm cấp con. ` +
        'Cần đề nghị Cục Doanh trại mở nhánh mới.',
    );
  }

  // Suy đoạn biến thiên từ chính các con hiện có; chọn đoạn phổ biến nhất
  // phòng trường hợp nhánh có con ở nhiều cấp khác nhau.
  const tally = new Map<number, number>();
  for (const code of siblingCodes) {
    const index = levelOf(code) - 1;
    if (index > parentLevel - 1 && index <= 5) {
      tally.set(index, (tally.get(index) ?? 0) + 1);
    }
  }

  let segmentIndex = parentLevel;
  let inferredFrom: AllocatedCode['inferredFrom'] = 'parent-level';
  if (tally.size) {
    segmentIndex = [...tally.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )[0][0];
    inferredFrom = 'siblings';
  }

  const width = segmentWidth(segmentIndex);
  const sentinel = sentinelValue(segmentIndex);

  const used = siblingCodes
    .map((code) => parseInt(splitSegments(code)[segmentIndex], 10))
    .filter((value) => Number.isFinite(value) && value !== sentinel);

  const next = (used.length ? Math.max(...used) : 0) + 1;
  if (next >= sentinel) {
    throw new Error(
      `Nhánh ${parentCode} đã hết mã (đoạn ${segmentIndex + 1} chạm giá trị dành riêng ` +
        `${sentinel}). Cần đề nghị Cục Doanh trại mở nhánh mới.`,
    );
  }

  const segments = splitSegments(parentCode);
  segments[segmentIndex] = String(next).padStart(width, '0');
  return { code: joinSegments(segments), segmentIndex, inferredFrom };
}
