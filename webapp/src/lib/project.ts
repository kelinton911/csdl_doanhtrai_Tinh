// Nhãn tiếng Việt + màu cho dự án XDCB/đầu tư (M13).

export const PROJECT_TYPE_LABEL: Record<string, string> = {
  NEW_BUILD: 'Xây mới',
  RENOVATION: 'Cải tạo',
  REPAIR: 'Sửa chữa lớn',
  UPGRADE: 'Nâng cấp',
  INFRASTRUCTURE: 'Hạ tầng',
};

export const FUNDING_LABEL: Record<string, string> = {
  DEFENSE_BUDGET: 'Ngân sách quốc phòng',
  STATE_BUDGET: 'Ngân sách nhà nước',
  LOCAL: 'Ngân sách địa phương',
  OTHER: 'Nguồn khác',
};

// Vòng đời dự án — thứ tự + nhãn + màu.
export const PHASE_ORDER = ['PROPOSAL', 'DESIGN', 'BIDDING', 'CONTRACTED', 'IN_PROGRESS', 'ACCEPTANCE', 'HANDED_OVER', 'WARRANTY', 'CLOSED'];
export const PHASE_LABEL: Record<string, string> = {
  PROPOSAL: 'Chủ trương',
  DESIGN: 'Thiết kế',
  BIDDING: 'Lựa chọn nhà thầu',
  CONTRACTED: 'Đã ký hợp đồng',
  IN_PROGRESS: 'Đang thi công',
  ACCEPTANCE: 'Nghiệm thu',
  HANDED_OVER: 'Đã bàn giao',
  WARRANTY: 'Bảo hành',
  CLOSED: 'Quyết toán/kết thúc',
  CANCELLED: 'Đã hủy',
};
export function phaseColor(phase: string): { fg: string; bg: string; bd: string } {
  if (phase === 'CANCELLED') return { fg: 'var(--color-neutral-600)', bg: 'var(--color-neutral-100)', bd: 'var(--color-neutral-300)' };
  if (phase === 'CLOSED' || phase === 'HANDED_OVER' || phase === 'WARRANTY') return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
  if (phase === 'IN_PROGRESS' || phase === 'ACCEPTANCE') return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
  return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
}

export const MILESTONE_KIND_LABEL: Record<string, string> = {
  PLAN: 'Kế hoạch',
  PROGRESS: 'Tiến độ',
  ACCEPTANCE: 'Nghiệm thu',
  PAYMENT: 'Giải ngân/thanh toán',
  ISSUE: 'Vướng mắc',
};

export const PROJECT_TYPE_OPTIONS = Object.entries(PROJECT_TYPE_LABEL).map(([code, label]) => ({ code, label }));
export const FUNDING_OPTIONS = Object.entries(FUNDING_LABEL).map(([code, label]) => ({ code, label }));
export const MILESTONE_KIND_OPTIONS = Object.entries(MILESTONE_KIND_LABEL).map(([code, label]) => ({ code, label }));

// Giai đoạn kế tiếp trong vòng đời (để nút "chuyển giai đoạn").
export function nextPhase(phase: string): string | null {
  const i = PHASE_ORDER.indexOf(phase);
  return i >= 0 && i < PHASE_ORDER.length - 1 ? PHASE_ORDER[i + 1] : null;
}
