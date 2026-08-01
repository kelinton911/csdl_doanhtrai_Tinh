// Nhãn tiếng Việt + màu cho sẵn sàng chiến đấu / bảo đảm tác chiến (M18/M19).

export const SITE_TYPE_LABEL: Record<string, string> = {
  EVACUATION: 'Khu sơ tán', DISPERSAL: 'Khu phân tán', RESERVE: 'Địa điểm dự bị',
  DEPLOYMENT: 'Bố trí lực lượng', FIELD_MEDICAL: 'Quân y dã chiến', COMMAND_POST: 'Sở chỉ huy dự bị',
};
export const READINESS_LABEL: Record<string, string> = { READY: 'Sẵn sàng', PARTIAL: 'Một phần', NOT_READY: 'Chưa sẵn sàng' };
export function readinessColor(r: string): { fg: string; bg: string; bd: string } {
  if (r === 'READY') return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
  if (r === 'NOT_READY') return { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' };
  return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
}
export const ROLE_LABEL: Record<string, string> = { PRIMARY: 'Chính', BACKUP: 'Dự bị', ALTERNATE: 'Thay thế' };
export const CONCEALMENT_LABEL: Record<string, string> = { GOOD: 'Tốt', FAIR: 'Trung bình', POOR: 'Kém' };
export const DEFENSE_STATE_LABEL: Record<string, string> = {
  NORMAL: 'Thường xuyên', SSCD: 'Sẵn sàng chiến đấu', EVACUATION: 'Sơ tán/phân tán', COMBAT: 'Tác chiến', RECOVERY: 'Khắc phục',
};

export const SEVERITY_LABEL: Record<string, string> = { LIGHT: 'Nhẹ', MODERATE: 'Vừa', HEAVY: 'Nặng', DESTROYED: 'Phá hủy' };
export function severityColor(s: string): string {
  return s === 'DESTROYED' || s === 'HEAVY' ? 'var(--danger-fg)' : s === 'MODERATE' ? 'var(--warn-fg)' : 'var(--info-fg)';
}
export const RECOVERY_STATUS_LABEL: Record<string, string> = {
  ASSESSING: 'Đang đánh giá', COORDINATING: 'Đang điều phối', IN_PROGRESS: 'Đang khắc phục', RECOVERED: 'Đã khắc phục',
};
export function recoveryStatusColor(s: string): { fg: string; bg: string; bd: string } {
  if (s === 'RECOVERED') return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
  if (s === 'IN_PROGRESS' || s === 'COORDINATING') return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
  return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
}

export const SITE_TYPE_OPTIONS = Object.entries(SITE_TYPE_LABEL).map(([code, label]) => ({ code, label }));
export const READINESS_OPTIONS = Object.entries(READINESS_LABEL).map(([code, label]) => ({ code, label }));
export const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([code, label]) => ({ code, label }));
export const CONCEALMENT_OPTIONS = Object.entries(CONCEALMENT_LABEL).map(([code, label]) => ({ code, label }));
export const DEFENSE_STATE_OPTIONS = Object.entries(DEFENSE_STATE_LABEL).map(([code, label]) => ({ code, label }));
export const SEVERITY_OPTIONS = Object.entries(SEVERITY_LABEL).map(([code, label]) => ({ code, label }));
export const RECOVERY_STATUS_OPTIONS = Object.entries(RECOVERY_STATUS_LABEL).map(([code, label]) => ({ code, label }));
