import type { IconName } from '../components/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// "Hồ sơ vai trò" (role persona) — nguồn dữ liệu TẬP TRUNG cho toàn bộ trải nghiệm
// theo vai trò: nhãn, tông màu nhận diện (--dom-*), biểu tượng, khẩu hiệu nhiệm vụ,
// workspace tương ứng, thứ tự ưu tiên (khi user đa vai trò) và thanh hành động nhanh.
// Mỗi vai trò có một giao diện làm việc riêng, KHÔNG dùng chung một dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export type DomKey =
  | 'cmd' | 'geo' | 'asset' | 'stock' | 'audit'
  | 'repair' | 'cap' | 'plan' | 'report' | 'admin';

// Khoá workspace = tên component render giao diện riêng của vai trò.
export type WorkspaceKey =
  | 'admin' | 'command' | 'officer' | 'commune'
  | 'review' | 'audit' | 'report';

export const ROLE_LABEL: Record<string, string> = {
  SYS_ADMIN: 'Quản trị hệ thống',
  PROVINCIAL_COMMAND: 'Chỉ huy cấp tỉnh',
  BARRACKS_OFFICER: 'Cán bộ ngành doanh trại',
  COMMUNE_USER: 'Cán bộ Ban CHQS xã',
  REVIEWER: 'Kiểm duyệt viên',
  REPORT_VIEWER: 'Người xem báo cáo',
  AUDITOR: 'Cán bộ kiểm tra',
  INTEGRATION_CLIENT: 'Hệ thống tích hợp',
};

// Tông màu nhận diện của vai trò (ánh xạ sang token --dom-*). Cả vỏ giao diện
// (sidebar/topbar/accent) đổi theo giá trị này để "nhìn là biết đang ở vai trò nào".
export const ROLE_ACCENT: Record<string, DomKey> = {
  SYS_ADMIN: 'admin',
  PROVINCIAL_COMMAND: 'cmd',
  BARRACKS_OFFICER: 'asset',
  COMMUNE_USER: 'geo',
  REVIEWER: 'audit',
  AUDITOR: 'plan',
  REPORT_VIEWER: 'report',
  INTEGRATION_CLIENT: 'admin',
};

export const ROLE_ICON: Record<string, IconName> = {
  SYS_ADMIN: 'shield',
  PROVINCIAL_COMMAND: 'target',
  BARRACKS_OFFICER: 'building',
  COMMUNE_USER: 'map',
  REVIEWER: 'check',
  AUDITOR: 'clipboard',
  REPORT_VIEWER: 'chart',
  INTEGRATION_CLIENT: 'refresh',
};

// Một câu mô tả nhiệm vụ trọng tâm của vai trò (hiển thị ở tiêu đề workspace).
export const ROLE_TAGLINE: Record<string, string> = {
  SYS_ADMIN: 'Quản trị người dùng, danh mục, tích hợp và giám sát vận hành toàn hệ thống.',
  PROVINCIAL_COMMAND: 'Chỉ đạo, phê duyệt và nắm toàn cảnh sẵn sàng chiến đấu doanh trại toàn tỉnh.',
  BARRACKS_OFFICER: 'Quản lý doanh trại, công trình, kho trạm, sửa chữa và dự án đầu tư.',
  COMMUNE_USER: 'Khai báo và cập nhật hồ sơ doanh trại, kiểm kê, huy động nguồn lực tại địa bàn xã.',
  REVIEWER: 'Kiểm duyệt và phê chuẩn hồ sơ do các địa bàn gửi lên.',
  AUDITOR: 'Kiểm tra, thanh tra, theo dõi phát hiện và chất lượng dữ liệu.',
  REPORT_VIEWER: 'Xem báo cáo, thống kê, dự báo và mức hoàn chỉnh hồ sơ (chỉ đọc).',
  INTEGRATION_CLIENT: 'Trao đổi dữ liệu máy–máy qua API.',
};

// Workspace (giao diện làm việc) tương ứng mỗi vai trò.
export const ROLE_WORKSPACE: Record<string, WorkspaceKey> = {
  SYS_ADMIN: 'admin',
  PROVINCIAL_COMMAND: 'command',
  BARRACKS_OFFICER: 'officer',
  COMMUNE_USER: 'commune',
  REVIEWER: 'review',
  AUDITOR: 'audit',
  REPORT_VIEWER: 'report',
};

// Thứ tự ưu tiên khi user có nhiều vai trò → quyết định workspace & màu "chính".
const ROLE_PRIORITY: string[] = [
  'SYS_ADMIN',
  'PROVINCIAL_COMMAND',
  'REVIEWER',
  'AUDITOR',
  'BARRACKS_OFFICER',
  'COMMUNE_USER',
  'REPORT_VIEWER',
];

// Danh sách vai trò người dùng (có giao diện) — dùng cho dropdown "Xem như vai trò".
export const HUMAN_ROLES: string[] = [
  'PROVINCIAL_COMMAND',
  'BARRACKS_OFFICER',
  'COMMUNE_USER',
  'REVIEWER',
  'AUDITOR',
  'REPORT_VIEWER',
];

// Chọn vai trò "chính" từ danh sách roles của user (đã hoặc chưa qua "xem như").
export function primaryRole(roles: string[] | undefined): string {
  const list = roles ?? [];
  for (const r of ROLE_PRIORITY) if (list.includes(r)) return r;
  return list[0] ?? 'REPORT_VIEWER';
}

// Workspace ứng với danh sách roles hiện hành.
export function workspaceForRoles(roles: string[] | undefined): WorkspaceKey {
  return ROLE_WORKSPACE[primaryRole(roles)] ?? 'report';
}

export interface QuickAction {
  to: string;
  label: string;
  icon: IconName;
  dom: DomKey;
}

// Thanh hành động nhanh — các việc trọng tâm của mỗi vai trò (hiển thị đầu workspace).
const QUICK_ACTIONS: Record<WorkspaceKey, QuickAction[]> = {
  admin: [
    { to: '/admin', label: 'Quản trị hệ thống', icon: 'shield', dom: 'admin' },
    { to: '/import', label: 'Nhập liệu & đồng bộ', icon: 'upload', dom: 'admin' },
    { to: '/asset-catalog', label: 'Danh mục tài sản', icon: 'clipboard', dom: 'stock' },
    { to: '/map', label: 'Bản đồ doanh trại', icon: 'map', dom: 'geo' },
  ],
  command: [
    { to: '/approvals', label: 'Duyệt hồ sơ', icon: 'check', dom: 'audit' },
    { to: '/map', label: 'Bản đồ doanh trại', icon: 'map', dom: 'geo' },
    { to: '/reports', label: 'Báo cáo chỉ huy', icon: 'chart', dom: 'report' },
    { to: '/alerts', label: 'Trung tâm cảnh báo', icon: 'bell', dom: 'repair' },
  ],
  officer: [
    { to: '/barracks', label: 'Doanh trại', icon: 'building', dom: 'asset' },
    { to: '/storage', label: 'Kho trạm', icon: 'box', dom: 'stock' },
    { to: '/maintenance', label: 'Sửa chữa', icon: 'wrench', dom: 'repair' },
    { to: '/projects', label: 'Dự án đầu tư', icon: 'building', dom: 'repair' },
    { to: '/inspection', label: 'Kiểm kê', icon: 'clipboard', dom: 'audit' },
  ],
  commune: [
    { to: '/barracks/new', label: 'Khai báo doanh trại', icon: 'plus', dom: 'asset' },
    { to: '/field', label: 'Khảo sát hiện trường', icon: 'map', dom: 'geo' },
    { to: '/scan', label: 'Quét & tra cứu QR', icon: 'search', dom: 'stock' },
    { to: '/inspection', label: 'Kiểm kê', icon: 'clipboard', dom: 'audit' },
    { to: '/local-resources', label: 'Nguồn lực huy động', icon: 'target', dom: 'plan' },
  ],
  review: [
    { to: '/approvals', label: 'Hàng chờ duyệt', icon: 'check', dom: 'audit' },
    { to: '/inspection', label: 'Kiểm kê - biến động', icon: 'clipboard', dom: 'audit' },
    { to: '/barracks', label: 'Hồ sơ doanh trại', icon: 'building', dom: 'asset' },
  ],
  audit: [
    { to: '/audits', label: 'Kiểm tra - thanh tra', icon: 'shield', dom: 'audit' },
    { to: '/analytics', label: 'Chất lượng dữ liệu', icon: 'chart', dom: 'report' },
    { to: '/budgets', label: 'Ngân sách (xem)', icon: 'chart', dom: 'report' },
    { to: '/legal-documents', label: 'Văn bản - định mức', icon: 'file', dom: 'audit' },
  ],
  report: [
    { to: '/reports', label: 'Báo cáo - phân tích', icon: 'chart', dom: 'report' },
    { to: '/analytics', label: 'Dự báo & cảnh báo', icon: 'chart', dom: 'report' },
    { to: '/potential', label: 'Tiềm lực HC-KT', icon: 'target', dom: 'cmd' },
    { to: '/commune-readiness', label: 'Mức hoàn chỉnh hồ sơ', icon: 'chart', dom: 'cmd' },
  ],
};

export function quickActionsFor(workspace: WorkspaceKey): QuickAction[] {
  return QUICK_ACTIONS[workspace] ?? [];
}
