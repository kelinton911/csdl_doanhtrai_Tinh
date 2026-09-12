// Loại địa điểm nguồn vật chất — dùng để tách "nguồn vật chất thường xuyên của Tỉnh"
// theo từng loại nguồn khi cuộn cấp Tỉnh (Feature 01). Gắn trên kho (storage_locations).
// CAN_CU_HCKT_BI_MAT (căn cứ hậu cần-kỹ thuật bí mật) chỉ hiển thị cho vai trò cấp Tỉnh.
export enum SiteType {
  XA = 'XA', // kho/vật chất của xã
  DON_VI_TRUC_THUOC = 'DON_VI_TRUC_THUOC', // đơn vị trực thuộc Tỉnh
  KHO_TINH = 'KHO_TINH', // kho của Tỉnh
  CAN_CU_CHIEN_DAU = 'CAN_CU_CHIEN_DAU', // căn cứ chiến đấu
  PHAN_CAN_CU = 'PHAN_CAN_CU', // phân căn cứ
  CAN_CU_HCKT_BI_MAT = 'CAN_CU_HCKT_BI_MAT', // căn cứ hậu cần-kỹ thuật bí mật (mật)
}

export const SITE_TYPE_CODES: string[] = Object.values(SiteType);

export const SITE_TYPE_LABEL: Record<SiteType, string> = {
  [SiteType.XA]: 'Xã',
  [SiteType.DON_VI_TRUC_THUOC]: 'Đơn vị trực thuộc Tỉnh',
  [SiteType.KHO_TINH]: 'Kho của Tỉnh',
  [SiteType.CAN_CU_CHIEN_DAU]: 'Căn cứ chiến đấu',
  [SiteType.PHAN_CAN_CU]: 'Phân căn cứ',
  [SiteType.CAN_CU_HCKT_BI_MAT]: 'Căn cứ HC-KT (mật)',
};

// Loại địa điểm bí mật — chỉ vai trò xem toàn tỉnh (isProvinceWide) mới được thấy.
export const SECRET_SITE_TYPES: SiteType[] = [SiteType.CAN_CU_HCKT_BI_MAT];
