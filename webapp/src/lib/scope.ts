import type { Profile } from './auth';

// Vai trò được xem dữ liệu toàn tỉnh (không giới hạn theo đơn vị/địa bàn).
// GIỮ ĐỒNG BỘ với backend `common/data-scope.ts` (hằng PROVINCE_WIDE) — nguồn thực thi lọc là server.
const PROVINCE_WIDE = [
  'SYS_ADMIN',
  'PROVINCIAL_COMMAND',
  'BARRACKS_OFFICER',
  'REVIEWER',
  'AUDITOR',
  'REPORT_VIEWER',
];

export function isProvinceWide(profile: Profile | null): boolean {
  return !!profile?.roles?.some((r) => PROVINCE_WIDE.includes(r));
}

// Nhãn phạm vi dữ liệu THẬT của người dùng — chỉ để hiển thị (read-only), không phải bộ lọc.
// Ưu tiên: toàn tỉnh → số địa bàn (AREA: xã/phường/đặc khu) → đơn vị trực thuộc → chưa gán.
export function scopeLabel(profile: Profile | null): string {
  if (!profile) return '—';
  if (isProvinceWide(profile)) return 'Toàn tỉnh';
  const areas = (profile.dataScopes ?? []).filter((s) => s.type === 'AREA').length;
  if (areas > 0) return `${areas} địa bàn`;
  if (profile.organizationId) return 'Đơn vị trực thuộc';
  return 'Chưa gán phạm vi';
}
