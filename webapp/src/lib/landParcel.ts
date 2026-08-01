// Nhãn tiếng Việt + màu cho các thuộc tính khu đất quốc phòng (M04).

export const LANDUSE_LABEL: Record<string, string> = {
  QUOC_PHONG: 'Đất quốc phòng',
  HON_HOP: 'Hỗn hợp',
  KHAC: 'Khác',
};

export const USAGE_LABEL: Record<string, string> = {
  IN_USE: 'Đang sử dụng',
  VACANT: 'Đất trống',
  PLANNED: 'Quy hoạch',
  RESERVE: 'Dự bị',
  LEASED: 'Cho thuê/liên kết',
};

export const LEGAL_LABEL: Record<string, string> = {
  CERTIFICATE: 'Có GCN QSDĐ',
  DECISION: 'Có quyết định giao đất',
  PENDING: 'Đang hoàn thiện',
  NONE: 'Chưa có hồ sơ',
};

export const DISPUTE_LABEL: Record<string, string> = {
  NONE: 'Bình thường',
  DISPUTED: 'Có tranh chấp',
  ENCROACHED: 'Bị lấn chiếm',
};

export const EXPANSION_LABEL: Record<string, string> = {
  NONE: 'Không thể mở rộng',
  LIMITED: 'Mở rộng hạn chế',
  GOOD: 'Có thể mở rộng',
};

export const SAFETY_LABEL: Record<string, string> = {
  SAFE: 'An toàn',
  RISK: 'Có nguy cơ',
  UNSAFE: 'Không an toàn',
};

// Màu chip cho tình trạng tranh chấp: xanh (ổn) / cam (tranh chấp) / đỏ (lấn chiếm).
export function disputeColor(status: string): { fg: string; bg: string; bd: string } {
  if (status === 'ENCROACHED') return { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' };
  if (status === 'DISPUTED') return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
  return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
}

export const USAGE_OPTIONS = Object.entries(USAGE_LABEL).map(([code, label]) => ({ code, label }));
export const LEGAL_OPTIONS = Object.entries(LEGAL_LABEL).map(([code, label]) => ({ code, label }));
export const DISPUTE_OPTIONS = Object.entries(DISPUTE_LABEL).map(([code, label]) => ({ code, label }));
export const EXPANSION_OPTIONS = Object.entries(EXPANSION_LABEL).map(([code, label]) => ({ code, label }));
export const SAFETY_OPTIONS = Object.entries(SAFETY_LABEL).map(([code, label]) => ({ code, label }));
export const LANDUSE_OPTIONS = Object.entries(LANDUSE_LABEL).map(([code, label]) => ({ code, label }));
