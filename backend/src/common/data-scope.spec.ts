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

  // Ràng buộc quan trọng cho các module chỉ có area_id (nguồn lực huy động M16,
  // địa điểm sơ tán M18): cán bộ xã CHƯA được gán địa bàn phải nhận scope rỗng
  // (areaIds=[]) → lọc `area_id = ANY('{}')` trả về 0 bản ghi (mặc định hạn chế),
  // KHÔNG null (không được vô tình xem toàn tỉnh).
  it('cán bộ xã chưa gán địa bàn → scope hạn chế (areaIds rỗng), không phải toàn tỉnh', () => {
    const u = user([Role.COMMUNE_USER], 'org-commune', undefined);
    const scope = barracksScope(u);
    expect(scope).not.toBeNull();
    expect(scope).toEqual({ areaIds: [], organizationId: 'org-commune' });
  });

  it('INTEGRATION_CLIENT không thuộc nhóm toàn tỉnh → bị giới hạn', () => {
    expect(isProvinceWide(user([Role.INTEGRATION_CLIENT]))).toBe(false);
  });
});
