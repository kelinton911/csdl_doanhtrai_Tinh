// Danh mục vai trò (RBAC) theo Tài liệu mô tả Backend §4.
export enum Role {
  SYS_ADMIN = 'SYS_ADMIN',
  PROVINCIAL_COMMAND = 'PROVINCIAL_COMMAND',
  BARRACKS_OFFICER = 'BARRACKS_OFFICER',
  COMMUNE_USER = 'COMMUNE_USER',
  // Cán bộ đơn vị trực thuộc Tỉnh (Trung đoàn bộ binh địa phương…) — giới hạn theo
  // organizationId (org type=UNIT), khai báo/nhập liệu như COMMUNE_USER.
  UNIT_USER = 'UNIT_USER',
  REVIEWER = 'REVIEWER',
  REPORT_VIEWER = 'REPORT_VIEWER',
  AUDITOR = 'AUDITOR',
  INTEGRATION_CLIENT = 'INTEGRATION_CLIENT',
}

export const ALL_ROLES = Object.values(Role);
