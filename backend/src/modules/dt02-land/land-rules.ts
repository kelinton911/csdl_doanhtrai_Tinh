import { BadRequestException, ConflictException } from '@nestjs/common';

// Quy tắc miền DT-02 (Quyển II §VII) — hàm THUẦN, kiểm thử trực tiếp.

// ---- BR-DT02 (TC-DT02-003): diện tích phải > 0 ----
export function assertAreaPositive(area: number, field = 'diện tích'): void {
  if (!(area > 0)) {
    throw new BadRequestException(`VAL-001: ${field} phải lớn hơn 0`);
  }
}

// ---- BR-DT02-004 (TC-DT02-004): Σ phân bổ hiện trạng ≤ diện tích điểm đất ----
export function sumAreas(areas: number[]): number {
  return areas.reduce((s, a) => s + (Number(a) || 0), 0);
}
export function assertAllocationWithinArea(
  existingAllocatedM2: number[],
  newAreaM2: number,
  landAreaM2: number,
): void {
  assertAreaPositive(newAreaM2, 'diện tích phân bổ');
  const total = sumAreas(existingAllocatedM2) + newAreaM2;
  // Cho phép sai số làm tròn nhỏ (0.01 m²).
  if (total > landAreaM2 + 0.01) {
    throw new ConflictException(
      `DATA-003: Tổng phân bổ hiện trạng ${total.toFixed(2)} m² vượt diện tích điểm đất ${landAreaM2.toFixed(2)} m² (BR-DT02-004)`,
    );
  }
}

// ---- BR-DT02-005/007 (TC-DT02-007): diện tích tại thời điểm snapshot ----
// = diện tích gốc + Σ biến động có effective_date ≤ as_of. Kỳ trước biến động KHÔNG đổi.
export interface LandChange {
  areaDeltaM2: number;
  effectiveDate: string; // ISO date
}
export function areaAtSnapshot(baseAreaM2: number, changes: LandChange[], asOf: string): number {
  const cutoff = asOf;
  const delta = changes
    .filter((c) => c.effectiveDate <= cutoff)
    .reduce((s, c) => s + (Number(c.areaDeltaM2) || 0), 0);
  return baseAreaM2 + delta;
}

// ---- BR-DT02-019/020 (TC-DT02-017): cây kho không tự làm cha / không vòng lặp ----
export interface StorageNode {
  id: string;
  parentId: string | null;
}
export function wouldCreateStorageCycle(
  nodes: StorageNode[],
  childId: string,
  newParentId: string | null,
): boolean {
  if (!newParentId) return false;
  if (newParentId === childId) return true;
  const parentOf = new Map(nodes.map((n) => [n.id, n.parentId]));
  let cur: string | null | undefined = newParentId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === childId) return true;
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}
export function assertStorageParent(
  nodes: StorageNode[],
  childId: string,
  newParentId: string | null,
): void {
  if (wouldCreateStorageCycle(nodes, childId, newParentId)) {
    throw new ConflictException(
      'DATA-003: Cây vị trí kho tạo vòng lặp/tự làm cha (BR-DT02-019)',
    );
  }
}
