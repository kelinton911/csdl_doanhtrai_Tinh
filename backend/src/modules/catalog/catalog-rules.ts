import { BadRequestException, ConflictException } from '@nestjs/common';

// Quy tắc miền DT-01 (Quyển I §VII) — hàm THUẦN, tách khỏi service để kiểm thử trực tiếp
// và tái dùng nhất quán. Mọi cưỡng chế BR-DT01-* nằm ở đây.

// ---- BR-DT01-006: Mã tạm KHÔNG bắt đầu bằng R00 ----
export function isValidTempCode(code: string): boolean {
  return !/^\s*R00/i.test(code ?? '');
}
export function assertTempCodeNotR00(code: string): void {
  if (!isValidTempCode(code)) {
    throw new BadRequestException(
      'VAL-001: Mã tạm không được bắt đầu bằng "R00" (BR-DT01-006)',
    );
  }
}

// ---- BR-DT01-004/005: cây phân loại không tự làm cha, không vòng lặp ----
export interface TreeNode {
  id: string;
  parentId: string | null;
}

// parentId mới có tạo vòng lặp cho node childId không? (đi ngược lên gốc).
export function wouldCreateCycle(
  nodes: TreeNode[],
  childId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === childId) return true; // tự làm cha.
  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  let cur: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === childId) return true; // gặp lại chính nó → vòng lặp.
    if (seen.has(cur)) break; // vòng lặp sẵn có trong dữ liệu — dừng an toàn.
    seen.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}

// ---- TC-DT01-002: parent phải tồn tại trong cùng phiên bản ----
export function assertParentExists(
  nodeIds: Set<string>,
  parentId: string | null,
): void {
  if (parentId && !nodeIds.has(parentId)) {
    throw new BadRequestException(
      `VAL-001: Node cha ${parentId} không tồn tại trong phiên bản`,
    );
  }
}

// ---- BR-DT01-009: alias & tra mã chuẩn từ tên khác ----
// Chuẩn hóa: bỏ dấu tiếng Việt, hạ chữ thường, gộp khoảng trắng — để so khớp "gần đúng".
export function normalizeAlias(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh tiếng Việt
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export interface AliasEntry {
  aliasName: string;
  materialId: string;
  status: string; // ACTIVE | INACTIVE
}

// Tra mã chuẩn từ alias (trả các materialId khớp, đã lọc ACTIVE).
export function findMaterialsByAlias(
  aliases: AliasEntry[],
  query: string,
): string[] {
  const q = normalizeAlias(query);
  const ids = aliases
    .filter((a) => a.status === 'ACTIVE' && normalizeAlias(a.aliasName) === q)
    .map((a) => a.materialId);
  return Array.from(new Set(ids));
}

// Alias mới có ánh xạ mâu thuẫn (trỏ tới mã ĐANG hiệu lực khác) không?
export function hasAliasConflict(
  aliases: AliasEntry[],
  aliasName: string,
  materialId: string,
): boolean {
  const matches = findMaterialsByAlias(aliases, aliasName);
  return matches.some((id) => id !== materialId);
}

export function assertNoAliasConflict(
  aliases: AliasEntry[],
  aliasName: string,
  materialId: string,
): void {
  if (hasAliasConflict(aliases, aliasName, materialId)) {
    throw new ConflictException(
      `DATA-003: Tên khác "${aliasName}" đang trỏ tới mã khác (BR-DT01-009)`,
    );
  }
}

// ---- BR-DT01-011: mã cũ có mã thay thế → cảnh báo dùng mã hiện hành ----
export interface ReplacementEntry {
  oldMaterialId: string;
  newMaterialId: string;
  newCode?: string | null;
}
export interface ReplacementWarning {
  replaced: boolean;
  newMaterialId?: string;
  newCode?: string | null;
}
export function replacementWarning(
  replacements: ReplacementEntry[],
  materialId: string,
): ReplacementWarning {
  const r = replacements.find((x) => x.oldMaterialId === materialId);
  if (!r) return { replaced: false };
  return { replaced: true, newMaterialId: r.newMaterialId, newCode: r.newCode ?? null };
}

// ---- §3.3 So sánh 2 phiên bản danh mục (TC-DT01-007) ----
export interface CompareItem {
  code: string;
  name: string;
  unitCode?: string | null;
  parentCode?: string | null;
}
export interface VersionDiff {
  added: string[]; // mã mới
  removed: string[]; // mã bị bỏ (dữ liệu lịch sử vẫn giữ mã cũ)
  renamed: Array<{ code: string; from: string; to: string }>;
  unitChanged: Array<{ code: string; from: string | null; to: string | null }>;
  parentChanged: Array<{ code: string; from: string | null; to: string | null }>;
}

export function compareVersions(
  oldItems: CompareItem[],
  newItems: CompareItem[],
): VersionDiff {
  const oldMap = new Map(oldItems.map((i) => [i.code, i]));
  const newMap = new Map(newItems.map((i) => [i.code, i]));
  const diff: VersionDiff = {
    added: [],
    removed: [],
    renamed: [],
    unitChanged: [],
    parentChanged: [],
  };
  for (const code of newMap.keys()) if (!oldMap.has(code)) diff.added.push(code);
  for (const [code, oldItem] of oldMap) {
    const newItem = newMap.get(code);
    if (!newItem) {
      diff.removed.push(code);
      continue;
    }
    if (oldItem.name !== newItem.name) {
      diff.renamed.push({ code, from: oldItem.name, to: newItem.name });
    }
    if ((oldItem.unitCode ?? null) !== (newItem.unitCode ?? null)) {
      diff.unitChanged.push({ code, from: oldItem.unitCode ?? null, to: newItem.unitCode ?? null });
    }
    if ((oldItem.parentCode ?? null) !== (newItem.parentCode ?? null)) {
      diff.parentChanged.push({ code, from: oldItem.parentCode ?? null, to: newItem.parentCode ?? null });
    }
  }
  diff.added.sort();
  diff.removed.sort();
  return diff;
}

// ---- Import: kiểm tra cấu trúc từng dòng (TC-DT01-001/002) ----
export interface ImportRow {
  rowNo?: number;
  code?: string;
  name?: string;
  parentCode?: string;
  unitCode?: string;
}
export interface ImportRowError {
  rowNo: number;
  fieldName: string | null;
  errorCode: string;
  errorMessage: string;
  rawValue: string | null;
}

// Kiểm tra: thiếu mã/tên, mã trùng trong file, parentCode không tồn tại trong file.
export function validateImportRows(rows: ImportRow[]): ImportRowError[] {
  const errors: ImportRowError[] = [];
  const codes = new Set<string>();
  const seen = new Set<string>();
  for (const r of rows) codes.add((r.code ?? '').trim());
  rows.forEach((r, idx) => {
    const rowNo = r.rowNo ?? idx + 1;
    const code = (r.code ?? '').trim();
    if (!code) {
      errors.push({ rowNo, fieldName: 'code', errorCode: 'MISSING_CODE', errorMessage: 'Thiếu mã', rawValue: null });
    } else if (seen.has(code)) {
      errors.push({ rowNo, fieldName: 'code', errorCode: 'DUPLICATE_CODE', errorMessage: `Mã ${code} bị trùng trong file`, rawValue: code });
    }
    seen.add(code);
    if (!(r.name ?? '').trim()) {
      errors.push({ rowNo, fieldName: 'name', errorCode: 'MISSING_NAME', errorMessage: 'Thiếu tên', rawValue: null });
    }
    const parent = (r.parentCode ?? '').trim();
    if (parent && !codes.has(parent)) {
      errors.push({ rowNo, fieldName: 'parentCode', errorCode: 'PARENT_NOT_FOUND', errorMessage: `Mã cha ${parent} không có trong file`, rawValue: parent });
    }
  });
  return errors;
}
