import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { sha256Hex } from '../../common/crypto/stable-hash';
import { VerificationStatus } from './dt09.enums';

// -----------------------------------------------------------------------------
// DT-09 — Quy tắc nghiệp vụ THUẦN (không DB). Nơi giữ BR-DT09-* để unit-test.
// -----------------------------------------------------------------------------

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v : new Date(v);
}

// BR-DT09-001/002 — Trạng thái xác minh HIỆU LỰC tại thời điểm đọc.
// VERIFIED nhưng đã quá expires_at ⇒ coi EXPIRED (không còn dùng để cân đối).
export function effectiveVerificationStatus(
  status: VerificationStatus | null | undefined,
  expiresAt: Date | string | null | undefined,
  now: Date,
): VerificationStatus {
  if (status === VerificationStatus.VERIFIED) {
    const exp = toDate(expiresAt);
    if (exp && exp.getTime() < now.getTime()) return VerificationStatus.EXPIRED;
    return VerificationStatus.VERIFIED;
  }
  return status ?? VerificationStatus.UNVERIFIED;
}

// BR-DT09-001/002 — VERIFIED ≠ ELIGIBLE. Đủ điều kiện huy động khi:
// xác minh hiệu lực = VERIFIED, có mobilizable > 0, và lead_time ≤ deadline (nếu có).
export function isEligible(input: {
  status: VerificationStatus | null | undefined;
  expiresAt: Date | string | null | undefined;
  mobilizableQty: number;
  leadTimeDays: number | null;
  deadlineDays: number | null;
  now: Date;
}): boolean {
  const eff = effectiveVerificationStatus(input.status, input.expiresAt, input.now);
  if (eff !== VerificationStatus.VERIFIED) return false;
  if (!(input.mobilizableQty > 0)) return false;
  if (
    input.deadlineDays !== null &&
    input.leadTimeDays !== null &&
    input.leadTimeDays > input.deadlineDays
  ) {
    return false;
  }
  return true;
}

// BR-DT09-003 — mobilizable_qty KHÔNG được vượt verified_qty. verified_qty null ⇒ chưa xác minh, cấm.
export function assertMobilizable(mobilizableQty: number, verifiedQty: number | null): void {
  if (verifiedQty === null || verifiedQty === undefined) {
    throw new BusinessException(
      BusinessError.OVER_ALLOCATED,
      'Chưa xác minh (verified_qty) — không thể đánh giá huy động',
    );
  }
  if (round3(mobilizableQty) > round3(verifiedQty)) {
    throw new BusinessException(
      BusinessError.OVER_ALLOCATED,
      `mobilizable_qty ${mobilizableQty} > verified_qty ${verifiedQty}`,
    );
  }
}

// BR-DT09-008 — Σ giữ chỗ ACTIVE + lượng mới ≤ available (chống overbooking).
export function assertReservationWithinAvailable(
  sumActive: number,
  newQty: number,
  available: number,
): void {
  if (round3(sumActive + newQty) > round3(available)) {
    throw new BusinessException(
      BusinessError.INSUFFICIENT_FREE_SOURCE,
      `Giữ ${newQty} + đang giữ ${sumActive} > khả dụng ${available}`,
    );
  }
}

// Gap = supply_required − Σ planned_source_qty; kèm trạng thái dòng.
export function computeGap(
  supplyRequired: number,
  sumPlanned: number,
): { gap: number; status: 'OPEN' | 'PARTIAL' | 'COVERED' } {
  const gap = round3(supplyRequired - sumPlanned);
  let status: 'OPEN' | 'PARTIAL' | 'COVERED';
  if (gap <= 0) status = 'COVERED';
  else if (sumPlanned > 0) status = 'PARTIAL';
  else status = 'OPEN';
  return { gap, status };
}

// ---- Candidate service (Quyển IX §VII — 8 bước, có lý do loại) ----------------

export interface CandidateRow {
  sourceMaterialId: string;
  sourceId: string;
  materialCatalogId: string;
  verificationStatus: VerificationStatus | null;
  verifiedQty: number | null;
  expiresAt: Date | string | null;
  mobilizableQty: number;
  leadTimeDays: number | null;
  activeReserved: number; // Σ giữ chỗ ACTIVE của nguồn này
  distanceKm: number | null; // null = không xác định vị trí
  priority: number;
}

export interface CandidateOptions {
  materialCatalogId: string;
  now: Date;
  deadlineDays: number | null;
  radiusKm: number | null; // null = không lọc bán kính
}

export interface RankedCandidate extends CandidateRow {
  availableQty: number;
  rank: number; // thứ hạng 1-based theo đúng thứ tự xếp hạng (1 = ưu tiên nhất)
}

// Mã lý do loại (ổn định để test/hiển thị).
export type RejectReason =
  | 'MATERIAL_MISMATCH'
  | 'NOT_VERIFIED'
  | 'EXPIRED'
  | 'NOT_MOBILIZABLE'
  | 'NO_AVAILABLE'
  | 'OUT_OF_RADIUS'
  | 'LEAD_TIME_EXCEEDED';

export interface RejectedCandidate {
  sourceMaterialId: string;
  reason: RejectReason;
}

// 8 bước lọc → xếp hạng, kèm lý do loại từng nguồn. Không ném lỗi (chỉ phân loại).
export function rankCandidates(
  rows: CandidateRow[],
  opts: CandidateOptions,
): { ranked: RankedCandidate[]; rejected: RejectedCandidate[] } {
  const eligible: Omit<RankedCandidate, 'rank'>[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const r of rows) {
    // 1) khớp vật chất
    if (r.materialCatalogId !== opts.materialCatalogId) {
      rejected.push({ sourceMaterialId: r.sourceMaterialId, reason: 'MATERIAL_MISMATCH' });
      continue;
    }
    // 2)+3) đã xác minh & chưa hết hạn
    const eff = effectiveVerificationStatus(r.verificationStatus, r.expiresAt, opts.now);
    if (eff === VerificationStatus.EXPIRED) {
      rejected.push({ sourceMaterialId: r.sourceMaterialId, reason: 'EXPIRED' });
      continue;
    }
    if (eff !== VerificationStatus.VERIFIED) {
      rejected.push({ sourceMaterialId: r.sourceMaterialId, reason: 'NOT_VERIFIED' });
      continue;
    }
    // 4) mobilizable > 0
    if (!(r.mobilizableQty > 0)) {
      rejected.push({ sourceMaterialId: r.sourceMaterialId, reason: 'NOT_MOBILIZABLE' });
      continue;
    }
    // 5) còn available (mobilizable − Σ active reservation)
    const available = round3(r.mobilizableQty - r.activeReserved);
    if (!(available > 0)) {
      rejected.push({ sourceMaterialId: r.sourceMaterialId, reason: 'NO_AVAILABLE' });
      continue;
    }
    // 6) trong bán kính/địa bàn
    if (opts.radiusKm !== null && r.distanceKm !== null && r.distanceKm > opts.radiusKm) {
      rejected.push({ sourceMaterialId: r.sourceMaterialId, reason: 'OUT_OF_RADIUS' });
      continue;
    }
    // 7) lead_time ≤ deadline
    if (opts.deadlineDays !== null && r.leadTimeDays !== null && r.leadTimeDays > opts.deadlineDays) {
      rejected.push({ sourceMaterialId: r.sourceMaterialId, reason: 'LEAD_TIME_EXCEEDED' });
      continue;
    }
    // 8) qua đủ 7 bước → ứng viên (thứ hạng gán sau khi sắp xếp).
    eligible.push({ ...r, availableQty: available });
  }

  // Ưu tiên: priority nhỏ trước → lead_time nhỏ → khoảng cách nhỏ → available lớn.
  eligible.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const la = a.leadTimeDays ?? Number.MAX_SAFE_INTEGER;
    const lb = b.leadTimeDays ?? Number.MAX_SAFE_INTEGER;
    if (la !== lb) return la - lb;
    const da = a.distanceKm ?? Number.MAX_SAFE_INTEGER;
    const db = b.distanceKm ?? Number.MAX_SAFE_INTEGER;
    if (da !== db) return da - db;
    return b.availableQty - a.availableQty;
  });

  // Thứ hạng 1-based theo đúng thứ tự đã xếp — nguồn tốt nhất là "ứng viên #1".
  const ranked: RankedCandidate[] = eligible.map((r, i) => ({ ...r, rank: i + 1 }));
  return { ranked, rejected };
}

// ---- Snapshot bất biến (BR-DT09-020) -----------------------------------------

export interface FingerprintEntry {
  sourceMaterialId: string;
  verificationStatus: VerificationStatus | string | null;
  verifiedQty: number | null;
  mobilizableQty: number;
  reservedQty: number;
}

// Vân tay nguồn: truy tới trạng thái verification/mobilization + lượng đã giữ chỗ tại phê duyệt.
export function sourceFingerprint(entries: FingerprintEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.sourceMaterialId.localeCompare(b.sourceMaterialId));
  return sha256Hex(sorted);
}

export interface SnapshotLineForHash {
  materialCatalogId: string;
  supplyRequired: number;
  plannedSourceQty: number;
  gapQty: number;
}

// Checksum nội dung cân đối tại phê duyệt (sắp xếp theo vật chất để ổn định).
export function computeBalanceChecksum(
  planCode: string,
  revisionNo: number,
  lines: SnapshotLineForHash[],
  fingerprint: string,
): string {
  const sorted = [...lines].sort((a, b) => a.materialCatalogId.localeCompare(b.materialCatalogId));
  return sha256Hex({ planCode, revisionNo, fingerprint, lines: sorted });
}
