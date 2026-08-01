// Nhãn tiếng Việt + màu cho hạ tầng kỹ thuật (M11).

export const CATEGORY_LABEL: Record<string, string> = {
  ELECTRICITY: 'Điện',
  WATER: 'Nước',
  FUEL: 'Nhiên liệu',
};
export const CATEGORY_COLOR: Record<string, string> = {
  ELECTRICITY: '#f59e0b',
  WATER: '#0ea5e9',
  FUEL: '#8b5cf6',
};

export const KIND_LABEL: Record<string, string> = {
  POWER_GRID: 'Nguồn điện lưới',
  TRANSFORMER: 'Trạm biến áp',
  GENERATOR: 'Máy phát điện',
  POWER_INTERNAL: 'Điện nội bộ',
  WATER_SOURCE: 'Nguồn nước tập trung',
  WELL: 'Giếng khoan',
  WATER_TANK: 'Bể/bồn chứa nước',
  WATER_TREATMENT: 'Xử lý/lọc nước',
  WATER_NETWORK: 'Mạng cấp/thoát nước',
  FUEL_TANK: 'Kho/téc nhiên liệu',
};

// Nhóm kind theo category (đổ vào select khi tạo/sửa).
export const KIND_BY_CATEGORY: Record<string, string[]> = {
  ELECTRICITY: ['POWER_GRID', 'TRANSFORMER', 'GENERATOR', 'POWER_INTERNAL'],
  WATER: ['WATER_SOURCE', 'WELL', 'WATER_TANK', 'WATER_TREATMENT', 'WATER_NETWORK'],
  FUEL: ['FUEL_TANK'],
};
export const KIND_CATEGORY: Record<string, string> = Object.entries(KIND_BY_CATEGORY).reduce(
  (acc, [cat, kinds]) => { kinds.forEach((k) => (acc[k] = cat)); return acc; },
  {} as Record<string, string>,
);

export const STATUS_LABEL: Record<string, string> = {
  OPERATIONAL: 'Hoạt động',
  STANDBY: 'Dự phòng sẵn sàng',
  MAINTENANCE: 'Đang bảo dưỡng',
  FAULT: 'Hỏng hóc',
  DECOMMISSIONED: 'Ngừng sử dụng',
};
export function statusColor(status: string): { fg: string; bg: string; bd: string } {
  switch (status) {
    case 'OPERATIONAL': return { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' };
    case 'STANDBY': return { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' };
    case 'MAINTENANCE': return { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
    case 'FAULT': return { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' };
    default: return { fg: 'var(--color-neutral-600)', bg: 'var(--color-neutral-100)', bd: 'var(--color-neutral-300)' };
  }
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([code, label]) => ({ code, label }));
export const STATUS_OPTIONS = Object.entries(STATUS_LABEL).map(([code, label]) => ({ code, label }));
