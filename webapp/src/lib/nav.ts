import type { IconName } from '../components/Icon';

// Điều hướng tổ chức theo 3 LỚP nghiệp vụ (giảm trùng lặp, phản ánh luồng
// khai báo → duyệt → tổng hợp):
//   1) Danh mục chuẩn (tra cứu, GỐC là danh mục tài sản BQP) — xã chỉ chọn.
//   2) Khai báo thực địa (xã khai báo doanh trại/kho trạm/vật chất).
//   3) Duyệt & tổng hợp (chỉ huy xã duyệt; cấp Tỉnh xem qua data-scope).
// `roles` rỗng = mọi vai trò thấy được.
export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  dom: string; // biến màu nhóm nghiệp vụ (tokens: --dom-*)
  group: NavGroup;
  roles?: string[];
}

// Thứ tự hiển thị các nhóm trên sidebar.
export type NavGroup =
  | 'command'
  | 'declare'
  | 'review'
  | 'catalog'
  | 'plan'
  | 'admin';

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  command: 'Chỉ huy',
  declare: 'Khai báo địa bàn',
  review: 'Duyệt & kiểm tra',
  catalog: 'Danh mục dùng chung',
  plan: 'Kế hoạch & báo cáo',
  admin: 'Quản trị',
};

export const NAV_GROUP_ORDER: NavGroup[] = [
  'command',
  'declare',
  'review',
  'catalog',
  'plan',
  'admin',
];

// Các vai trò được khai báo/kiểm kê dữ liệu thực địa.
const FIELD_ROLES = ['BARRACKS_OFFICER', 'COMMUNE_USER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND'];
// Các vai trò tham gia duyệt hồ sơ.
const REVIEW_ROLES = ['REVIEWER', 'BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN'];
// Các vai trò tra cứu danh mục chuẩn.
const CATALOG_ROLES = ['BARRACKS_OFFICER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND', 'COMMUNE_USER', 'REVIEWER'];

export const NAV: NavItem[] = [
  // ── Lớp Chỉ huy ──────────────────────────────────────────────
  { to: '/dashboard', label: 'Tổng quan chỉ huy', icon: 'grid', dom: 'cmd', group: 'command' },
  { to: '/map', label: 'Bản đồ doanh trại', icon: 'map', dom: 'geo', group: 'command' },
  { to: '/tasks', label: 'Kế hoạch công tác & nhiệm vụ', icon: 'clipboard', dom: 'cmd', group: 'command', roles: ['PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN', 'COMMUNE_USER', 'REVIEWER'] },

  // ── Lớp Khai báo thực địa (việc hằng ngày của xã) ────────────
  { to: '/land-parcels', label: 'Khu đất quốc phòng', icon: 'map', dom: 'geo', group: 'declare' },
  { to: '/barracks', label: 'Doanh trại và công trình', icon: 'building', dom: 'asset', group: 'declare' },
  { to: '/field', label: 'Khảo sát hiện trường', icon: 'map', dom: 'asset', group: 'declare', roles: FIELD_ROLES },
  { to: '/scan', label: 'Quét & tra cứu QR', icon: 'search', dom: 'stock', group: 'declare', roles: FIELD_ROLES },
  { to: '/storage', label: 'Kho trạm', icon: 'box', dom: 'stock', group: 'declare', roles: FIELD_ROLES },
  { to: '/inventory', label: 'Vật chất trên địa bàn', icon: 'box', dom: 'stock', group: 'declare', roles: FIELD_ROLES },
  { to: '/utilities', label: 'Điện · nước · năng lượng', icon: 'wrench', dom: 'repair', group: 'declare' },

  // ── Lớp Duyệt & kiểm tra ─────────────────────────────────────
  { to: '/approvals', label: 'Hàng chờ duyệt', icon: 'check', dom: 'audit', group: 'review', roles: REVIEW_ROLES },
  { to: '/inspection', label: 'Kiểm kê - biến động', icon: 'clipboard', dom: 'audit', group: 'review', roles: ['BARRACKS_OFFICER', 'COMMUNE_USER', 'REVIEWER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND'] },
  { to: '/maintenance', label: 'Sửa chữa - khôi phục', icon: 'wrench', dom: 'repair', group: 'review', roles: ['BARRACKS_OFFICER', 'COMMUNE_USER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND'] },
  { to: '/audits', label: 'Kiểm tra - thanh tra', icon: 'shield', dom: 'audit', group: 'review', roles: ['AUDITOR', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN', 'REVIEWER', 'COMMUNE_USER'] },

  // ── Lớp Danh mục dùng chung (tra cứu; GỐC là danh mục BQP) ────
  { to: '/asset-catalog', label: 'Danh mục tài sản BQP', icon: 'clipboard', dom: 'stock', group: 'catalog', roles: CATALOG_ROLES },
  { to: '/material-groups', label: 'Nhóm ngành vật chất', icon: 'box', dom: 'stock', group: 'catalog', roles: CATALOG_ROLES },
  { to: '/materials', label: 'Danh mục vật chất', icon: 'clipboard', dom: 'stock', group: 'catalog', roles: CATALOG_ROLES },
  { to: '/legal-documents', label: 'Văn bản - tiêu chuẩn - định mức', icon: 'file', dom: 'audit', group: 'catalog' },

  // ── Lớp Kế hoạch & báo cáo ───────────────────────────────────
  { to: '/projects', label: 'Xây dựng & dự án đầu tư', icon: 'building', dom: 'repair', group: 'plan', roles: ['BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN', 'REVIEWER', 'REPORT_VIEWER'] },
  { to: '/scenarios', label: 'Kế hoạch và tình huống', icon: 'target', dom: 'plan', group: 'plan', roles: ['BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN'] },
  { to: '/potential', label: 'Tiềm lực HC-KT', icon: 'target', dom: 'cmd', group: 'plan', roles: ['SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'REVIEWER', 'REPORT_VIEWER', 'AUDITOR'] },
  { to: '/local-resources', label: 'Nguồn lực huy động', icon: 'target', dom: 'plan', group: 'plan', roles: ['SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'COMMUNE_USER', 'REVIEWER', 'REPORT_VIEWER'] },
  { to: '/commune-readiness', label: 'Mức hoàn chỉnh hồ sơ xã', icon: 'chart', dom: 'cmd', group: 'plan', roles: ['SYS_ADMIN', 'PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'REVIEWER', 'REPORT_VIEWER'] },
  { to: '/budgets', label: 'Kế hoạch & ngân sách', icon: 'chart', dom: 'report', group: 'plan', roles: ['PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN', 'REPORT_VIEWER', 'AUDITOR'] },
  { to: '/reports', label: 'Báo cáo - phân tích', icon: 'chart', dom: 'report', group: 'plan' },

  // ── Lớp Quản trị ─────────────────────────────────────────────
  { to: '/import', label: 'Nhập liệu & đồng bộ', icon: 'upload', dom: 'admin', group: 'admin', roles: ['BARRACKS_OFFICER', 'SYS_ADMIN', 'INTEGRATION_CLIENT'] },
  { to: '/admin', label: 'Quản trị hệ thống', icon: 'shield', dom: 'admin', group: 'admin', roles: ['SYS_ADMIN', 'AUDITOR'] },
];

export function visibleNav(roles: string[]): NavItem[] {
  return NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
}

// Nhóm các mục điều hướng đã lọc theo vai trò thành từng nhóm (giữ thứ tự chuẩn),
// bỏ nhóm rỗng. Dùng để render tiêu đề nhóm trên sidebar.
export function groupedNav(roles: string[]): Array<{ group: NavGroup; label: string; items: NavItem[] }> {
  const visible = visibleNav(roles);
  return NAV_GROUP_ORDER.map((group) => ({
    group,
    label: NAV_GROUP_LABEL[group],
    items: visible.filter((n) => n.group === group),
  })).filter((g) => g.items.length > 0);
}
