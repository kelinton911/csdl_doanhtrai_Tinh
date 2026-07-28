import { AuthUser } from './decorators/current-user.decorator';
import { Role } from '../modules/identity/roles';

// Vai trò được xem toàn tỉnh (không giới hạn theo đơn vị).
const PROVINCE_WIDE: string[] = [
  Role.SYS_ADMIN,
  Role.PROVINCIAL_COMMAND,
  Role.BARRACKS_OFFICER,
  Role.REVIEWER,
  Role.AUDITOR,
  Role.REPORT_VIEWER,
];

// Người dùng có được xem dữ liệu toàn tỉnh hay bị giới hạn theo đơn vị của mình?
export function isProvinceWide(user: AuthUser | undefined): boolean {
  if (!user) return false;
  return user.roles?.some((r) => PROVINCE_WIDE.includes(r)) ?? false;
}

// Trả về organizationId dùng để lọc list, hoặc null nếu được xem toàn tỉnh.
// Thực thi lọc dữ liệu theo quyền ở TẦNG SERVER (ROADMAP §5, không chỉ ở UI).
export function scopeOrganizationId(user: AuthUser | undefined): string | null {
  if (isProvinceWide(user)) return null;
  return user?.organizationId ?? null;
}

// Danh sách area refId trong phạm vi dữ liệu của người dùng (từ dataScopes type=AREA).
export function scopeAreaIds(user: AuthUser | undefined): string[] {
  if (!user?.dataScopes) return [];
  return user.dataScopes.filter((s) => s.type === 'AREA').map((s) => s.refId);
}

// Bộ lọc phạm vi cho list doanh trại/công trình theo địa bàn + đơn vị.
// null = xem toàn tỉnh; ngược lại giới hạn theo area scopes hoặc organizationId.
export interface BarracksScope {
  areaIds: string[];
  organizationId: string | null;
}
export function barracksScope(user: AuthUser | undefined): BarracksScope | null {
  if (isProvinceWide(user)) return null;
  return {
    areaIds: scopeAreaIds(user),
    organizationId: user?.organizationId ?? null,
  };
}
