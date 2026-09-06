import { BusinessError, BusinessException } from '../../common/errors/business-error';

// Quy tắc miền DT-04 (Quyển IV §II/§VII) — hàm THUẦN, kiểm thử trực tiếp.
// Đây là lõi ngữ nghĩa SEM-HC dùng cho DT-08/10.

// Loại giao dịch sổ cái.
export enum MovementType {
  OPENING = 'OPENING', // số dư đầu kỳ (+)
  RECEIPT = 'RECEIPT', // tiếp nhận (+)
  ISSUE = 'ISSUE', // xuất (−)
  TRANSFER_IN = 'TRANSFER_IN', // điều chuyển đến (+)
  TRANSFER_OUT = 'TRANSFER_OUT', // điều chuyển đi (−)
  ADJUSTMENT = 'ADJUSTMENT', // điều chỉnh (± theo delta)
}

// Máy trạng thái giao dịch (BR-DT04-004): chỉ POSTED tác động số dư; POSTED bất biến → reversal.
export enum MovementStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED',
}

export const MOVEMENT_TRANSITIONS: Record<MovementStatus, MovementStatus[]> = {
  [MovementStatus.DRAFT]: [MovementStatus.SUBMITTED, MovementStatus.CANCELLED],
  [MovementStatus.SUBMITTED]: [MovementStatus.APPROVED, MovementStatus.DRAFT, MovementStatus.CANCELLED],
  [MovementStatus.APPROVED]: [MovementStatus.POSTED, MovementStatus.CANCELLED],
  [MovementStatus.POSTED]: [MovementStatus.REVERSED],
  [MovementStatus.REVERSED]: [],
  [MovementStatus.CANCELLED]: [],
};

// Dấu của loại giao dịch. ADJUSTMENT dùng dấu của delta truyền vào.
export function movementSign(type: MovementType): 1 | -1 | 0 {
  switch (type) {
    case MovementType.OPENING:
    case MovementType.RECEIPT:
    case MovementType.TRANSFER_IN:
      return 1;
    case MovementType.ISSUE:
    case MovementType.TRANSFER_OUT:
      return -1;
    case MovementType.ADJUSTMENT:
      return 0; // dùng delta có dấu.
  }
}

// Số lượng có dấu của một giao dịch.
export function signedQuantity(type: MovementType, quantity: number): number {
  const sign = movementSign(type);
  if (type === MovementType.ADJUSTMENT) return quantity; // delta đã mang dấu.
  return sign * Math.abs(quantity);
}

// ---- HC(t) as-of-time (BR-DT04-013/020, TC-DT04-007) ----
// HC = Σ signed(quantity) của các giao dịch POSTED có effective_time ≤ as_of.
export interface LedgerEntry {
  status: MovementStatus;
  effectiveTime: string | Date;
  signed: number;
}
export function hcAtTime(entries: LedgerEntry[], asOf: string | Date): number {
  const cutoff = new Date(asOf).getTime();
  return entries
    .filter((e) => e.status === MovementStatus.POSTED && new Date(e.effectiveTime).getTime() <= cutoff)
    .reduce((sum, e) => sum + (Number(e.signed) || 0), 0);
}

// ---- BR-DT04-005 (TC-DT04-003): xuất/giảm không làm tồn âm ----
export function assertSufficientStock(hcBefore: number, delta: number, allowNegative = false): void {
  if (allowNegative) return;
  if (hcBefore + delta < -1e-9) {
    throw new BusinessException(
      BusinessError.INSUFFICIENT_STOCK,
      `Tồn hiện có ${hcBefore} không đủ để giảm ${Math.abs(delta)}`,
    );
  }
}

// ---- BR-DT04-006 (TC-DT04-008): Σ cấp chất lượng 1..5 ≤ HC lô ----
export function assertQualityWithinHc(gradeQuantities: number[], hc: number): void {
  const total = gradeQuantities.reduce((s, q) => s + (Number(q) || 0), 0);
  if (total > hc + 1e-9) {
    throw new BusinessException(
      BusinessError.QUALITY_TOTAL_MISMATCH,
      `Σ cấp chất lượng ${total} vượt HC lô ${hc}`,
    );
  }
}

// ---- BR-DT04-011 (TC-DT04-017): snapshot LOCKED bất biến ----
export function assertSnapshotUnlocked(locked: boolean): void {
  if (locked) {
    throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'Snapshot đã khóa, không được sửa');
  }
}

// ---- BR-DT04-004 (TC-DT04-004): giao dịch POSTED không sửa trực tiếp ----
export function assertMovementEditable(status: MovementStatus): void {
  if (status === MovementStatus.POSTED || status === MovementStatus.REVERSED) {
    throw new BusinessException(
      BusinessError.LOCKED_IMMUTABLE,
      `Giao dịch ${status} bất biến — dùng reversal (BR-DT04-004)`,
    );
  }
}
