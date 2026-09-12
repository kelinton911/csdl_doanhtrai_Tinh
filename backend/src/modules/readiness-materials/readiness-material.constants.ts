// Bốn mức Sẵn sàng chiến đấu (SSCĐ) theo thứ tự nâng cấp — Trục B của luồng vật chất.
// ⚠ KHÁC `reserve_purpose` (mục đích dự trữ ở stock_quality_details, có giá trị trùng chữ
// THUONG_XUYEN nhưng khác miền) và KHÁC `defense_state` của địa điểm bố trí.
// Xem docs/ADR-2026-08-01-luong-du-lieu-vat-chat-doanh-trai.md.
export const READINESS_STATES = ['THUONG_XUYEN', 'TANG_CUONG', 'CAO', 'TOAN_BO'] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

export const READINESS_STATE_LABEL: Record<ReadinessState, string> = {
  THUONG_XUYEN: 'Thường xuyên',
  TANG_CUONG: 'Tăng cường',
  CAO: 'Cao',
  TOAN_BO: 'Toàn bộ',
};

// Mức liền dưới để sao chép (copy-forward). Trả null nếu là mức nền (Thường xuyên).
export function previousState(state: string): ReadinessState | null {
  const i = READINESS_STATES.indexOf(state as ReadinessState);
  return i > 0 ? READINESS_STATES[i - 1] : null;
}

// Feature 03 — Phương án phân cấp lượng vật chất SSCĐ do cấp Tỉnh xây dựng (top-down).
// CHỈ gồm 3 trạng thái SSCĐ (không có "Thường xuyên") — mỗi trạng thái một bảng riêng.
export const SSCD_ALLOCATION_STATES = ['TANG_CUONG', 'CAO', 'TOAN_BO'] as const;
export type SscdAllocationState = (typeof SSCD_ALLOCATION_STATES)[number];

// Các cấp phân bổ lượng (phân cấp lượng) — cột trên mỗi dòng vật chất.
export const ALLOCATION_TIERS = ['KHO_TINH', 'XA', 'TRUNG_DOAN', 'CAN_CU'] as const;
export type AllocationTier = (typeof ALLOCATION_TIERS)[number];

export const ALLOCATION_TIER_LABEL: Record<AllocationTier, string> = {
  KHO_TINH: 'Kho của Tỉnh',
  XA: 'Xã',
  TRUNG_DOAN: 'Trung đoàn địa phương',
  CAN_CU: 'Căn cứ',
};
