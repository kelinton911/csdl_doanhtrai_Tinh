// Bốn mức Sẵn sàng chiến đấu (SSCĐ) — Trục B. Đồng bộ với backend READINESS_STATES.
// ⚠ Khác reserve_purpose (mục đích dự trữ) và defense_state (địa điểm bố trí).
export const READINESS_STATES = ['THUONG_XUYEN', 'TANG_CUONG', 'CAO', 'TOAN_BO'] as const;
export type ReadinessState = (typeof READINESS_STATES)[number];

export const READINESS_STATE_LABEL: Record<string, string> = {
  THUONG_XUYEN: 'Thường xuyên',
  TANG_CUONG: 'Tăng cường',
  CAO: 'Cao',
  TOAN_BO: 'Toàn bộ',
};

export const readinessLabel = (s: string | null | undefined) =>
  (s && READINESS_STATE_LABEL[s]) || s || '—';

// Mức liền dưới để copy-forward; null nếu là mức nền (Thường xuyên).
export function previousReadinessState(s: string): ReadinessState | null {
  const i = READINESS_STATES.indexOf(s as ReadinessState);
  return i > 0 ? READINESS_STATES[i - 1] : null;
}

// Feature 03 — Phương án phân cấp lượng SSCĐ (top-down cấp Tỉnh): chỉ 3 trạng thái SSCĐ.
export const SSCD_ALLOCATION_STATES = ['TANG_CUONG', 'CAO', 'TOAN_BO'] as const;
export type SscdAllocationState = (typeof SSCD_ALLOCATION_STATES)[number];

// Các cấp phân bổ lượng (khớp cột backend readiness_allocation_lines).
export const ALLOCATION_TIERS = [
  { key: 'qtyKhoTinh', label: 'Kho Tỉnh' },
  { key: 'qtyXa', label: 'Xã' },
  { key: 'qtyTrungDoan', label: 'Trung đoàn' },
  { key: 'qtyCanCu', label: 'Căn cứ' },
] as const;
