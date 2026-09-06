import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  BomItemStatus,
  CompletenessLevel,
  TechVerificationStatus,
} from './tech.enums';

// Quy tắc miền DT-03 (Quyển III §VII) — hàm THUẦN, kiểm thử trực tiếp.

// ---- BR-DT03-006 (TC-DT03-006): chỉ dữ liệu VERIFIED mới được dùng làm tiêu chí ----
export function assertVerifiedForCriterion(status: TechVerificationStatus): void {
  if (status !== TechVerificationStatus.VERIFIED) {
    throw new BadRequestException(
      `VAL-001: Giá trị chưa VERIFIED (đang ${status}) không được dùng làm tiêu chí (BR-DT03-006)`,
    );
  }
}

// ---- BR-DT03-005 (TC-DT03-005): BOM item chưa ánh xạ component → UNMAPPED ----
export function bomItemStatus(componentId: string | null | undefined): BomItemStatus {
  return componentId ? BomItemStatus.MAPPED : BomItemStatus.UNMAPPED;
}

// ---- BR-DT03-005 (TC-DT03-003): trùng file theo hash → cảnh báo, không nhân bản ----
export function isDuplicateHash(existingHashes: string[], hash: string): boolean {
  return existingHashes.includes(hash);
}

// ---- BR-DT03-013/014 (TC-DT03-008): quan hệ thay thế không tạo vòng lặp ----
export interface RelEdge {
  source: string;
  target: string;
}
// Thêm cạnh source→target có tạo vòng lặp? (có đường đi target ⇝ source sẵn có).
export function wouldCreateRelationshipCycle(
  edges: RelEdge[],
  source: string,
  target: string,
): boolean {
  if (source === target) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  }
  // DFS từ target; nếu quay lại source → vòng lặp.
  const stack = [target];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === source) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const nxt of adj.get(cur) ?? []) stack.push(nxt);
  }
  return false;
}
export function assertNoRelationshipCycle(edges: RelEdge[], source: string, target: string): void {
  if (wouldCreateRelationshipCycle(edges, source, target)) {
    throw new ConflictException(
      'DATA-003: Quan hệ thay thế tạo vòng lặp (BR-DT03-013)',
    );
  }
}

// ---- Độ đầy đủ hồ sơ kỹ thuật (INCOMPLETE → PARTIAL → COMPLETE_VERIFIED) ----
export interface CompletenessFlags {
  hasDrawing: boolean;
  hasSpecs: boolean;
  hasBom: boolean;
  hasDocument: boolean;
  allSpecsVerified: boolean; // mọi thông số ở trạng thái VERIFIED
}
export function computeCompleteness(f: CompletenessFlags): CompletenessLevel {
  const core = [f.hasDrawing, f.hasSpecs, f.hasBom, f.hasDocument];
  if (core.every(Boolean) && f.allSpecsVerified) return CompletenessLevel.COMPLETE_VERIFIED;
  if (core.some(Boolean)) return CompletenessLevel.PARTIAL;
  return CompletenessLevel.INCOMPLETE;
}
