import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataScopeGuard } from './data-scope.guard';
import { buildScopeContext, isWithinScope } from './scope-context';
import { BusinessException } from '../errors/business-error';
import { AuthUser } from '../decorators/current-user.decorator';
import { Role } from '../../modules/identity/roles';

const user = (
  roles: string[],
  organizationId: string | null,
  dataScopes: AuthUser['dataScopes'] = undefined,
): AuthUser => ({ sub: 'u1', username: 'u', roles, organizationId, dataScopes });

function ctxWith(
  u: AuthUser,
  opts: {
    method?: string;
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    dims?: string[];
  },
): { ctx: ExecutionContext; req: any } {
  const req: any = {
    method: opts.method ?? 'GET',
    user: u,
    params: opts.params,
    query: opts.query,
    body: opts.body,
  };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  const reflector = { getAllAndOverride: () => opts.dims } as unknown as Reflector;
  (ctx as any).__reflector = reflector;
  return { ctx, req };
}

function guardFor(dims: string[] | undefined): DataScopeGuard {
  const reflector = { getAllAndOverride: () => dims } as unknown as Reflector;
  return new DataScopeGuard(reflector);
}

describe('buildScopeContext / isWithinScope', () => {
  it('tách organization/area/mission từ dataScopes', () => {
    const s = buildScopeContext(
      user([Role.COMMUNE_USER], 'org-a', [
        { type: 'AREA', refId: 'area-1' },
        { type: 'MISSION', refId: 'm-9' },
      ]),
    );
    expect(s.provinceWide).toBe(false);
    expect(s.organizationId).toBe('org-a');
    expect(s.areaIds).toEqual(['area-1']);
    expect(s.missionIds).toEqual(['m-9']);
  });

  it('province-wide không giới hạn theo chiều nào', () => {
    const s = buildScopeContext(user([Role.PROVINCIAL_COMMAND], 'org-a'));
    expect(isWithinScope(s, 'organization', 'org-b')).toBe(true);
  });

  it('user chưa gán area → mọi area đều ngoài phạm vi', () => {
    const s = buildScopeContext(user([Role.COMMUNE_USER], 'org-a', undefined));
    expect(isWithinScope(s, 'area', 'area-x')).toBe(false);
  });
});

describe('DataScopeGuard (SYS-BR-08, TC-S0-001)', () => {
  it('user đơn vị A gọi API đơn vị B → 403 NO_PERMISSION_SCOPE', () => {
    const u = user([Role.COMMUNE_USER], 'org-A');
    const { ctx } = ctxWith(u, {
      method: 'GET',
      query: { organizationId: 'org-B' },
      dims: ['organization'],
    });
    const guard = guardFor(['organization']);
    expect.assertions(2);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect(e).toBeInstanceOf(BusinessException);
      expect((e as BusinessException).getCode()).toBe('NO_PERMISSION_SCOPE');
    }
  });

  it('user đơn vị A gọi chính đơn vị A → cho qua + gắn req.scope', () => {
    const u = user([Role.COMMUNE_USER], 'org-A', [{ type: 'AREA', refId: 'area-1' }]);
    const { ctx, req } = ctxWith(u, {
      method: 'GET',
      query: { organizationId: 'org-A' },
      dims: ['organization'],
    });
    const guard = guardFor(['organization']);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.scope.organizationId).toBe('org-A');
  });

  it('chặn body ghi đè organization_id sang đơn vị khác (POST)', () => {
    const u = user([Role.COMMUNE_USER], 'org-A');
    const { ctx } = ctxWith(u, {
      method: 'POST',
      body: { organization_id: 'org-Z', name: 'x' },
      dims: ['organization'],
    });
    const guard = guardFor(['organization']);
    expect(() => guard.canActivate(ctx)).toThrow(BusinessException);
  });

  it('vai trò toàn tỉnh đi qua mọi phạm vi', () => {
    const u = user([Role.PROVINCIAL_COMMAND], 'org-A');
    const { ctx } = ctxWith(u, {
      method: 'GET',
      query: { organizationId: 'org-B' },
      dims: ['organization'],
    });
    const guard = guardFor(['organization']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('handler không @Scoped → không cưỡng chế, vẫn gắn scope', () => {
    const u = user([Role.COMMUNE_USER], 'org-A');
    const { ctx, req } = ctxWith(u, { method: 'GET', query: { organizationId: 'org-B' } });
    const guard = guardFor(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.scope.organizationId).toBe('org-A');
  });
});
