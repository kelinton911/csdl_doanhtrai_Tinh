// Nhãn tiếng Việt + màu cho văn bản pháp quy (M20).

export const DOC_TYPE_LABEL: Record<string, string> = {
  LAW: 'Luật',
  DECREE: 'Nghị định',
  CIRCULAR: 'Thông tư',
  DECISION: 'Quyết định',
  REGULATION: 'Quy định',
  STANDARD: 'Tiêu chuẩn/Quy chuẩn',
  NORM: 'Định mức KT-KT',
  GUIDELINE: 'Hướng dẫn',
  PLAN: 'Kế hoạch',
  OTHER: 'Khác',
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Dự thảo',
  EFFECTIVE: 'Đang hiệu lực',
  EXPIRED: 'Hết hiệu lực',
  SUPERSEDED: 'Đã bị thay thế',
  REVOKED: 'Đã bãi bỏ',
};
export function statusColor(s: string): { fg: string; bg: string; bd: string } {
  switch (s) {
    case 'EFFECTIVE': return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
    case 'SUPERSEDED': return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
    case 'DRAFT': return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
    default: return { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' };
  }
}

export const FIELD_LABEL: Record<string, string> = {
  DOANH_TRAI: 'Doanh trại', DAT_DAI: 'Đất đai', VAT_CHAT: 'Vật chất', TAI_CHINH: 'Tài chính',
  XDCB: 'Xây dựng cơ bản', DIEN_NUOC: 'Điện - nước', KIEM_TRA: 'Kiểm tra', CHUNG: 'Chung',
};

export const CONFIDENTIALITY_LABEL: Record<string, string> = {
  PUBLIC: 'Công khai', INTERNAL: 'Nội bộ', CONFIDENTIAL: 'Mật', SECRET: 'Tối mật',
};
export function confidentialityColor(c: string): string {
  return c === 'SECRET' ? 'var(--danger-fg)' : c === 'CONFIDENTIAL' ? 'var(--warn-fg)' : c === 'PUBLIC' ? 'var(--ok-fg)' : 'var(--color-neutral-600)';
}

export const DOC_TYPE_OPTIONS = Object.entries(DOC_TYPE_LABEL).map(([code, label]) => ({ code, label }));
export const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([code, label]) => ({ code, label }));
export const FIELD_OPTIONS = Object.entries(FIELD_LABEL).map(([code, label]) => ({ code, label }));
export const CONFIDENTIALITY_OPTIONS = Object.entries(CONFIDENTIALITY_LABEL).map(([code, label]) => ({ code, label }));
