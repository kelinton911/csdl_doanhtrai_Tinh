import { AuthUser } from '../decorators/current-user.decorator';
import { isProvinceWide } from '../data-scope';
import { BusinessError, BusinessException } from '../errors/business-error';

// Ba chiều phạm vi dữ liệu (SYS-BR-08: quyền = chức năng ∧ phạm vi).
export type ScopeDimension = 'organization' | 'area' | 'mission';

// Ngữ cảnh phạm vi rút ra từ token — nguồn sự thật để service lọc row-level.
// KHÔNG tin organization_id/area_id trong request body (Sprint 0 §5, SYS-BR-08).
export interface ScopeContext {
  provinceWide: boolean; // true = xem toàn tỉnh, không giới hạn.
  organizationId: string | null;
  areaIds: string[];
  missionIds: string[];
}

// Dựng ScopeContext từ AuthUser (vai trò + dataScopes trong token).
export function buildScopeContext(user: AuthUser | undefined): ScopeContext {
  const provinceWide = isProvinceWide(user);
  const scopes = user?.dataScopes ?? [];
  return {
    provinceWide,
    organizationId: user?.organizationId ?? null,
    areaIds: scopes.filter((s) => s.type === 'AREA').map((s) => s.refId),
    missionIds: scopes.filter((s) => s.type === 'MISSION').map((s) => s.refId),
  };
}

// Giá trị được phép theo từng chiều (null = không giới hạn theo chiều đó).
function allowedValues(scope: ScopeContext, dim: ScopeDimension): string[] | null {
  if (scope.provinceWide) return null;
  switch (dim) {
    case 'organization':
      return scope.organizationId ? [scope.organizationId] : [];
    case 'area':
      return scope.areaIds;
    case 'mission':
      return scope.missionIds;
  }
}

// Kiểm tra một giá trị cụ thể có nằm trong phạm vi được giao không.
// province-wide → luôn true; ngược lại phải khớp danh sách cho phép (rỗng → false).
export function isWithinScope(
  scope: ScopeContext,
  dim: ScopeDimension,
  value: string | null | undefined,
): boolean {
  const allowed = allowedValues(scope, dim);
  if (allowed === null) return true;
  if (value === null || value === undefined) return true; // sẽ được service tự bơm scope.
  return allowed.includes(value);
}

// Ném NO_PERMISSION_SCOPE (403) nếu vượt phạm vi — dùng ở service khi cần cưỡng chế.
export function assertWithinScope(
  scope: ScopeContext,
  dim: ScopeDimension,
  value: string | null | undefined,
): void {
  if (!isWithinScope(scope, dim, value)) {
    throw new BusinessException(
      BusinessError.NO_PERMISSION_SCOPE,
      `Vượt phạm vi dữ liệu (${dim}=${value ?? 'null'})`,
    );
  }
}
