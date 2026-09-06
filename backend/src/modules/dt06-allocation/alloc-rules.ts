import { BusinessError, BusinessException } from '../../common/errors/business-error';

// Quy tắc miền DT-06 (Quyển VI §III/§VIII) — hàm THUẦN, kiểm thử trực tiếp.
// Phân bổ là LỚP PHỦ ngữ nghĩa trên HC (DT-04); KHÔNG tự trừ/tạo số tồn (SYS-BR-02).

// Ngữ nghĩa loại phân bổ.
export enum AllocationSemantics {
  EXCLUSIVE = 'EXCLUSIVE', // khóa cứng — tính vào ràng buộc Σ ≤ HC_ALLOCATABLE
  OVERLAY = 'OVERLAY', // nhãn phân tích — KHÔNG tiêu tốn khả dụng
}

// Phân nhóm mục đích (để cấp PC_SSCĐ cho DT-08).
export enum AllocationCategory {
  REGULAR = 'REGULAR', // thường xuyên
  CARRYOVER = 'CARRYOVER', // gối đầu
  SSCD = 'SSCD', // sẵn sàng chiến đấu
  AD_HOC = 'AD_HOC', // đột xuất
  PENDING = 'PENDING', // chờ xử lý
  SLOW_MOVING = 'SLOW_MOVING', // chậm luân chuyển (overlay)
}

export enum HoldStatus {
  ACTIVE = 'ACTIVE',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

export enum AllocationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  SUPERSEDED = 'SUPERSEDED',
}

export const ALLOCATION_TRANSITIONS: Record<AllocationStatus, AllocationStatus[]> = {
  [AllocationStatus.DRAFT]: [AllocationStatus.SUBMITTED],
  [AllocationStatus.SUBMITTED]: [AllocationStatus.APPROVED, AllocationStatus.DRAFT],
  [AllocationStatus.APPROVED]: [AllocationStatus.SUPERSEDED],
  [AllocationStatus.SUPERSEDED]: [],
};

// ---- SYS-BR-05 / BR-DT06-002 (TC-DT06-002/003): Σ hold EXCLUSIVE ≤ HC_ALLOCATABLE ----
export function sumExclusive(exclusiveHoldQtys: number[]): number {
  return exclusiveHoldQtys.reduce((s, q) => s + (Number(q) || 0), 0);
}

// HC_ALLOCATABLE = HC − (IN_TRANSIT + chờ xử lý loại trừ). Ở nguồn, IN_TRANSIT đã giảm HC
// nên mặc định excluded = phần PENDING/loại trừ cấu hình.
export function hcAllocatable(hc: number, excluded = 0): number {
  return hc - excluded;
}

export function assertExclusiveWithinAllocatable(
  existingExclusiveQtys: number[],
  newQty: number,
  hcAllocatableValue: number,
): void {
  const total = sumExclusive(existingExclusiveQtys) + (Number(newQty) || 0);
  if (total > hcAllocatableValue + 1e-9) {
    throw new BusinessException(
      BusinessError.OVER_ALLOCATED,
      `Σ khóa exclusive ${total} vượt HC khả dụng ${hcAllocatableValue} (SYS-BR-05)`,
    );
  }
}

// ---- BR-DT06-008/009 (TC-DT06-008): đối chiếu định mức DT-07 → thiếu/đủ/vượt ----
export type ReserveGapStatus = 'SHORTAGE' | 'MET' | 'EXCESS';
export function reserveGap(requiredQty: number, allocatedQty: number): {
  gapQty: number;
  status: ReserveGapStatus;
} {
  const gapQty = requiredQty - allocatedQty; // dương = còn thiếu
  const status: ReserveGapStatus = gapQty > 1e-9 ? 'SHORTAGE' : gapQty < -1e-9 ? 'EXCESS' : 'MET';
  return { gapQty, status };
}

// ---- BR-DT06-020 (TC-DT06-020): DT-05 làm HC tụt dưới tổng hold → chặn ----
export function assertHcCoversHolds(hcAfter: number, totalExclusiveHold: number): void {
  if (hcAfter < totalExclusiveHold - 1e-9) {
    throw new BusinessException(
      BusinessError.OVER_ALLOCATED,
      `HC sau giao dịch ${hcAfter} thấp hơn tổng nguồn đã khóa ${totalExclusiveHold} (BR-DT06-020)`,
    );
  }
}

// ---- BR-DT06-011 (TC-DT06-023): snapshot phân bổ LOCKED bất biến ----
export function assertAllocationSnapshotUnlocked(locked: boolean): void {
  if (locked) {
    throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'Snapshot phân bổ đã khóa');
  }
}
