// Nhãn tiếng Việt + màu cho ngân sách (M14).
export { FUNDING_LABEL } from './project';

export const BUDGET_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Dự thảo',
  APPROVED: 'Đã chốt',
  CLOSED: 'Đã quyết toán',
};
export function budgetStatusColor(s: string): { fg: string; bg: string; bd: string } {
  if (s === 'APPROVED') return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
  if (s === 'CLOSED') return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
  return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
}

export const LINE_CATEGORY_LABEL: Record<string, string> = {
  CONSTRUCTION: 'Xây dựng',
  MAINTENANCE: 'Sửa chữa - bảo trì',
  EQUIPMENT: 'Trang thiết bị',
  UTILITY: 'Điện - nước',
  MATERIAL: 'Vật chất - vật tư',
  OTHER: 'Khác',
};
export const LINE_CATEGORY_OPTIONS = Object.entries(LINE_CATEGORY_LABEL).map(([code, label]) => ({ code, label }));
