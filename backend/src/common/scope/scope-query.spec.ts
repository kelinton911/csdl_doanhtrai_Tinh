import { AuthUser } from '../decorators/current-user.decorator';
import { BusinessException } from '../errors/business-error';
import { buildScopeContext } from './scope-context';
import { applyOrgScope, applyJsonOrgScope, assertReadScope, orgScopeWhere } from './scope-query';

// User toàn tỉnh (SYS_ADMIN) và user giới hạn theo đơn vị (COMMUNE_USER).
const provincial: AuthUser = {
  sub: 'u-admin',
  username: 'admin',
  roles: ['SYS_ADMIN'],
  organizationId: 'ORG-PROV',
};
const scoped: AuthUser = {
  sub: 'u-xa01',
  username: 'xa01',
  roles: ['COMMUNE_USER'],
  organizationId: 'ORG-A',
};

// Giả lập QueryBuilder tối thiểu để bắt tham số andWhere.
function fakeQb() {
  const calls: Array<{ sql: string; params: Record<string, unknown> }> = [];
  const qb = {
    calls,
    andWhere(sql: string, params: Record<string, unknown>) {
      calls.push({ sql, params });
      return qb;
    },
  };
  return qb as unknown as import('typeorm').SelectQueryBuilder<Record<string, unknown>> & {
    calls: typeof calls;
  };
}

describe('scope-query (SYS-BR-08 row-level)', () => {
  it('orgScopeWhere: province-wide không giới hạn, scoped lọc theo organizationId', () => {
    expect(orgScopeWhere(provincial)).toEqual({});
    expect(orgScopeWhere(scoped)).toEqual({ organizationId: 'ORG-A' });
  });

  it('applyOrgScope: province-wide no-op; scoped thêm andWhere đúng org', () => {
    const q1 = fakeQb();
    applyOrgScope(q1, 'm', provincial);
    expect(q1.calls).toHaveLength(0);

    const q2 = fakeQb();
    applyOrgScope(q2, 'm', scoped);
    expect(q2.calls).toHaveLength(1);
    expect(q2.calls[0].sql).toContain('m.organization_id =');
    expect(q2.calls[0].params.__scopeOrg).toBe('ORG-A');
  });

  it('applyJsonOrgScope: scoped lọc theo scope_json ->> organizationId', () => {
    const q = fakeQb();
    applyJsonOrgScope(q, 's', scoped);
    expect(q.calls[0].sql).toContain("scope_json ->> :__scopeKey");
    expect(q.calls[0].params.__scopeOrg).toBe('ORG-A');
  });

  it('assertReadScope: cùng org qua được, khác org ném 403, config (org null) bỏ qua', () => {
    const scope = buildScopeContext(scoped);
    expect(() => assertReadScope(scope, 'ORG-A')).not.toThrow();
    expect(() => assertReadScope(scope, null)).not.toThrow();
    expect(() => assertReadScope(scope, 'ORG-B')).toThrow(BusinessException);
    // province-wide đọc mọi org.
    expect(() => assertReadScope(buildScopeContext(provincial), 'ORG-B')).not.toThrow();
  });
});
