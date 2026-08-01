// Nhãn tiếng Việt + màu cho kiểm tra/thanh tra (M22).

export const TYPE_LABEL: Record<string, string> = {
  PERIODIC: 'Định kỳ',
  SURPRISE: 'Đột xuất',
  THEMATIC: 'Chuyên đề',
  AUDIT: 'Kiểm toán',
  SUPERIOR: 'Cấp trên',
};

export const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Kế hoạch',
  IN_PROGRESS: 'Đang kiểm tra',
  REPORTED: 'Đã lập biên bản',
  CLOSED: 'Kết thúc',
  CANCELLED: 'Đã hủy',
};
export function statusColor(s: string): { fg: string; bg: string; bd: string } {
  switch (s) {
    case 'CLOSED': return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
    case 'IN_PROGRESS': return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
    case 'REPORTED': return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
    case 'CANCELLED': return { fg: 'var(--color-neutral-600)', bg: 'var(--color-neutral-100)', bd: 'var(--color-neutral-300)' };
    default: return { fg: 'var(--color-neutral-700)', bg: 'var(--color-neutral-100)', bd: 'var(--color-neutral-300)' };
  }
}

export const SEVERITY_LABEL: Record<string, string> = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Cao', CRITICAL: 'Nghiêm trọng' };
export function severityColor(s: string): string {
  return s === 'CRITICAL' ? 'var(--danger-fg)' : s === 'HIGH' ? 'var(--danger-fg)' : s === 'MEDIUM' ? 'var(--warn-fg)' : 'var(--info-fg)';
}

export const FINDING_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Chưa xử lý',
  IN_PROGRESS: 'Đang khắc phục',
  RESOLVED: 'Đã khắc phục',
  ACCEPTED: 'Đã xác nhận',
};
export function findingStatusColor(s: string): { fg: string; bg: string; bd: string } {
  switch (s) {
    case 'ACCEPTED': return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
    case 'RESOLVED': return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
    case 'IN_PROGRESS': return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
    default: return { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' };
  }
}

export const TYPE_OPTIONS = Object.entries(TYPE_LABEL).map(([code, label]) => ({ code, label }));
export const SEVERITY_OPTIONS = Object.entries(SEVERITY_LABEL).map(([code, label]) => ({ code, label }));
