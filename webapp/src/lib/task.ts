// Nhãn tiếng Việt + màu cho nhiệm vụ / kế hoạch công tác (M21).

export const CATEGORY_LABEL: Record<string, string> = {
  PLAN: 'Kế hoạch công tác',
  DECLARATION: 'Khai báo',
  INSPECTION_TASK: 'Kiểm kê/kiểm tra',
  REPORT: 'Báo cáo',
  CONSTRUCTION: 'Xây dựng',
  MAINTENANCE: 'Sửa chữa - bảo trì',
  OTHER: 'Khác',
};

export const PRIORITY_LABEL: Record<string, string> = { LOW: 'Thấp', NORMAL: 'Bình thường', HIGH: 'Cao', URGENT: 'Khẩn' };
export function priorityColor(p: string): string {
  return p === 'URGENT' ? 'var(--danger-fg)' : p === 'HIGH' ? 'var(--warn-fg)' : p === 'LOW' ? 'var(--color-neutral-500)' : 'var(--info-fg)';
}

export const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang thực hiện',
  SUBMITTED: 'Đã nộp',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};
export function statusColor(s: string): { fg: string; bg: string; bd: string } {
  switch (s) {
    case 'COMPLETED': return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
    case 'IN_PROGRESS': return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
    case 'SUBMITTED': return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
    case 'CANCELLED': return { fg: 'var(--color-neutral-600)', bg: 'var(--color-neutral-100)', bd: 'var(--color-neutral-300)' };
    default: return { fg: 'var(--color-neutral-700)', bg: 'var(--color-neutral-100)', bd: 'var(--color-neutral-300)' };
  }
}

export const UPDATE_KIND_LABEL: Record<string, string> = { PROGRESS: 'Tiến độ', COMMENT: 'Trao đổi', STATUS: 'Trạng thái' };

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([code, label]) => ({ code, label }));
export const PRIORITY_OPTIONS = Object.entries(PRIORITY_LABEL).map(([code, label]) => ({ code, label }));
