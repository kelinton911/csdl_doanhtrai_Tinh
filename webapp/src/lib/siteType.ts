// Loại địa điểm nguồn vật chất (khớp backend inventory/site-type.ts) — dùng để tách
// "nguồn vật chất thường xuyên của Tỉnh" theo từng loại nguồn.
export const SITE_TYPES = [
  'XA',
  'DON_VI_TRUC_THUOC',
  'KHO_TINH',
  'CAN_CU_CHIEN_DAU',
  'PHAN_CAN_CU',
  'CAN_CU_HCKT_BI_MAT',
] as const;

export type SiteType = (typeof SITE_TYPES)[number];

export const SITE_TYPE_LABEL: Record<string, string> = {
  XA: 'Xã',
  DON_VI_TRUC_THUOC: 'Đơn vị trực thuộc Tỉnh',
  KHO_TINH: 'Kho của Tỉnh',
  CAN_CU_CHIEN_DAU: 'Căn cứ chiến đấu',
  PHAN_CAN_CU: 'Phân căn cứ',
  CAN_CU_HCKT_BI_MAT: 'Căn cứ HC-KT (mật)',
};

export const siteTypeLabel = (v: string | null | undefined): string =>
  v ? SITE_TYPE_LABEL[v] ?? v : '— (chưa phân loại)';
