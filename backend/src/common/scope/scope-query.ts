import { SelectQueryBuilder } from 'typeorm';
import { AuthUser } from '../decorators/current-user.decorator';
import { isProvinceWide, scopeOrganizationId } from '../data-scope';
import { assertWithinScope, buildScopeContext, ScopeContext } from './scope-context';

// Bộ lọc phạm vi row-level cấp SERVER (SYS-BR-08). Bổ trợ DataScopeGuard: guard chỉ chặn
// khi request truyền tường minh organization_id vượt phạm vi; helper này bảo đảm mọi
// truy vấn list/read chỉ trả dữ liệu trong phạm vi được giao (chống rò rỉ list/search).
// province-wide → không giới hạn; ngược lại → giới hạn theo organizationId trong token.

// Điều kiện `where` cho repository.find(...) — {} nghĩa là không giới hạn.
export function orgScopeWhere(user: AuthUser | undefined): { organizationId?: string } {
  if (isProvinceWide(user)) return {};
  const org = scopeOrganizationId(user);
  return org ? { organizationId: org } : { organizationId: '__none__' };
}

// Áp phạm vi đơn vị vào QueryBuilder theo cột thực (mặc định organization_id).
// province-wide → no-op. Trả lại chính qb để tiện chuỗi.
export function applyOrgScope<T extends import('typeorm').ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  user: AuthUser | undefined,
  column = 'organization_id',
): SelectQueryBuilder<T> {
  if (isProvinceWide(user)) return qb;
  const org = scopeOrganizationId(user) ?? '__none__';
  return qb.andWhere(`${alias}.${column} = :__scopeOrg`, { __scopeOrg: org });
}

// Áp phạm vi đơn vị khi org nằm trong cột JSONB (DT-08 scenario, DT-11 report_instance).
export function applyJsonOrgScope<T extends import('typeorm').ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  user: AuthUser | undefined,
  jsonCol = 'scope_json',
  key = 'organizationId',
): SelectQueryBuilder<T> {
  if (isProvinceWide(user)) return qb;
  const org = scopeOrganizationId(user) ?? '__none__';
  return qb.andWhere(`${alias}.${jsonCol} ->> :__scopeKey = :__scopeOrg`, {
    __scopeKey: key,
    __scopeOrg: org,
  });
}

// Cưỡng chế phạm vi khi đọc 1 bản ghi theo id. organizationId null (dữ liệu cấu hình dùng
// chung) → bỏ qua. Vượt phạm vi → 403 NO_PERMISSION_SCOPE.
export function assertReadScope(
  scope: ScopeContext | undefined,
  organizationId: string | null | undefined,
  user?: AuthUser | undefined,
): void {
  if (organizationId === null || organizationId === undefined) return;
  const ctx = scope ?? buildScopeContext(user);
  if (ctx.provinceWide) return;
  assertWithinScope(ctx, 'organization', organizationId);
}
