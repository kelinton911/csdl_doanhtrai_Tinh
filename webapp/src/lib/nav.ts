import type { IconName } from '../components/Icon';

// 9 nhóm chức năng (Frontend §4). `roles` rỗng = mọi vai trò thấy được.
export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  dom: string; // biến màu nhóm nghiệp vụ (tokens: --dom-*)
  roles?: string[];
}

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Tổng quan chỉ huy', icon: 'grid', dom: 'cmd' },
  { to: '/map', label: 'Bản đồ doanh trại', icon: 'map', dom: 'geo' },
  { to: '/barracks', label: 'Doanh trại và công trình', icon: 'building', dom: 'asset' },
  { to: '/inventory', label: 'Vật chất và vật tư', icon: 'box', dom: 'stock' },
  {
    to: '/materials',
    label: 'Danh mục vật chất',
    icon: 'clipboard',
    dom: 'stock',
    roles: ['BARRACKS_OFFICER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND', 'COMMUNE_USER'],
  },
  {
    to: '/import',
    label: 'Nhập liệu & đồng bộ',
    icon: 'upload',
    dom: 'admin',
    roles: ['BARRACKS_OFFICER', 'SYS_ADMIN', 'INTEGRATION_CLIENT'],
  },
  {
    to: '/inspection',
    label: 'Kiểm kê - biến động',
    icon: 'clipboard',
    dom: 'audit',
    roles: ['BARRACKS_OFFICER', 'COMMUNE_USER', 'REVIEWER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND'],
  },
  {
    to: '/maintenance',
    label: 'Sửa chữa - khôi phục',
    icon: 'wrench',
    dom: 'repair',
    roles: ['BARRACKS_OFFICER', 'COMMUNE_USER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND'],
  },
  {
    to: '/scenarios',
    label: 'Kế hoạch và tình huống',
    icon: 'target',
    dom: 'plan',
    roles: ['BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN'],
  },
  { to: '/reports', label: 'Báo cáo - phân tích', icon: 'chart', dom: 'report' },
  {
    to: '/admin',
    label: 'Quản trị hệ thống',
    icon: 'shield',
    dom: 'admin',
    roles: ['SYS_ADMIN', 'AUDITOR'],
  },
];

export function visibleNav(roles: string[]): NavItem[] {
  return NAV.filter((n) => !n.roles || n.roles.some((r) => roles.includes(r)));
}
