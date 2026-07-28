import {
  isProvinceWide,
  scopeOrganizationId,
  scopeAreaIds,
  barracksScope,
} from './data-scope';
import { Role } from '../modules/identity/roles';
import { AuthUser } from './decorators/current-user.decorator';

const user = (
  roles: string[],
  orgId: string | null = 'org-1',
  dataScopes: AuthUser['dataScopes'] = undefined,
): AuthUser => ({
  sub: 'u1',
  username: 'u',
  roles,
  organizationId: orgId,
  dataScopes,
});

describe('data-scope (M-cross-cutting, ROADMAP §5)', () => {
  it('vai trò cấp tỉnh xem toàn tỉnh (không giới hạn)', () => {
    expect(isProvinceWide(user([Role.PROVINCIAL_COMMAND]))).toBe(true);
    expect(isProvinceWide(user([Role.BARRACKS_OFFICER]))).toBe(true);
    expect(isProvinceWide(user([Role.SYS_ADMIN]))).toBe(true);
    expect(scopeOrganizationId(user([Role.PROVINCIAL_COMMAND]))).toBeNull();
    expect(barracksScope(user([Role.BARRACKS_OFFICER]))).toBeNull();
  });

  it('cán bộ cấp xã bị giới hạn theo đơn vị + địa bàn', () => {
    const u = user([Role.COMMUNE_USER], 'org-commune', [
      { type: 'AREA', refId: 'area-a01' },
      { type: 'ORGANIZATION', refId: 'ignored' },
    ]);
    expect(isProvinceWide(u)).toBe(false);
    expect(scopeOrganizationId(u)).toBe('org-commune');
    expect(scopeAreaIds(u)).toEqual(['area-a01']);
    expect(barracksScope(u)).toEqual({ areaIds: ['area-a01'], organizationId: 'org-commune' });
  });

  it('user không xác định → không phải toàn tỉnh, scope rỗng', () => {
    expect(isProvinceWide(undefined)).toBe(false);
    expect(scopeAreaIds(undefined)).toEqual([]);
  });
});
