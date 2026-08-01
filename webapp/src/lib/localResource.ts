// Nhãn tiếng Việt + màu cho nguồn lực huy động (M16).

export const CATEGORY_LABEL: Record<string, string> = {
  FACILITY: 'Cơ sở/mặt bằng',
  UTILITY: 'Điện/nước/máy',
  MATERIAL: 'Vật liệu/cung ứng',
  EQUIPMENT: 'Phương tiện thi công',
  SERVICE: 'Nhân lực/dịch vụ',
  OTHER: 'Khác',
};
export const CATEGORY_COLOR: Record<string, string> = {
  FACILITY: '#0ea5e9',
  UTILITY: '#f59e0b',
  MATERIAL: '#16a34a',
  EQUIPMENT: '#8b5cf6',
  SERVICE: '#e11d48',
  OTHER: '#64748b',
};

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  LODGING: 'Cơ sở lưu trú',
  WAREHOUSE: 'Nhà kho',
  WORKSHOP: 'Nhà xưởng',
  SCHOOL_HALL: 'Trường học/hội trường',
  OPEN_LAND: 'Khu đất trống',
  POWER_BACKUP: 'Nguồn điện dự phòng',
  WATER_SOURCE: 'Nguồn nước',
  GENERATOR: 'Máy phát điện',
  PUMP: 'Máy bơm',
  BUILDING_MATERIAL: 'Vật liệu xây dựng',
  MATERIAL_FACTORY: 'Cơ sở SX vật liệu',
  SUPPLY_FURNITURE: 'Cung ứng bàn/ghế/giường/tủ/bạt',
  CONSTRUCTION_EQUIP: 'Phương tiện thi công',
  TECH_TEAM: 'Đội ngũ kỹ thuật',
  CONSTRUCTION_FIRM: 'Doanh nghiệp xây dựng',
  REPAIR_SHOP: 'Cơ sở sửa chữa',
  OTHER: 'Khác',
};

export const TYPE_BY_CATEGORY: Record<string, string[]> = {
  FACILITY: ['LODGING', 'WAREHOUSE', 'WORKSHOP', 'SCHOOL_HALL', 'OPEN_LAND'],
  UTILITY: ['POWER_BACKUP', 'WATER_SOURCE', 'GENERATOR', 'PUMP'],
  MATERIAL: ['BUILDING_MATERIAL', 'MATERIAL_FACTORY', 'SUPPLY_FURNITURE'],
  EQUIPMENT: ['CONSTRUCTION_EQUIP'],
  SERVICE: ['TECH_TEAM', 'CONSTRUCTION_FIRM', 'REPAIR_SHOP'],
  OTHER: ['OTHER'],
};
export const TYPE_CATEGORY: Record<string, string> = Object.entries(TYPE_BY_CATEGORY).reduce(
  (acc, [cat, types]) => { types.forEach((t) => (acc[t] = cat)); return acc; },
  {} as Record<string, string>,
);

export const OWNER_LABEL: Record<string, string> = {
  STATE: 'Nhà nước', ENTERPRISE: 'Doanh nghiệp', PRIVATE: 'Tư nhân', INDIVIDUAL: 'Cá nhân/hộ',
};
export const MOBILIZATION_LABEL: Record<string, string> = {
  IMMEDIATE: 'Tức thời (<6h)', SHORT: 'Ngắn (<24h)', MEDIUM: 'Vừa (1-3 ngày)', LONG: 'Dài (>3 ngày)',
};
export const RELIABILITY_LABEL: Record<string, string> = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };
export function reliabilityColor(v: string): string {
  return v === 'HIGH' ? 'var(--ok-fg)' : v === 'LOW' ? 'var(--danger-fg)' : 'var(--warn-fg)';
}
export const AGREEMENT_LABEL: Record<string, string> = { NONE: 'Chưa có hiệp đồng', SIGNED: 'Đã ký hiệp đồng', EXPIRED: 'Hết hiệu lực' };

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL).map(([code, label]) => ({ code, label }));
export const OWNER_OPTIONS = Object.entries(OWNER_LABEL).map(([code, label]) => ({ code, label }));
export const MOBILIZATION_OPTIONS = Object.entries(MOBILIZATION_LABEL).map(([code, label]) => ({ code, label }));
export const RELIABILITY_OPTIONS = Object.entries(RELIABILITY_LABEL).map(([code, label]) => ({ code, label }));
