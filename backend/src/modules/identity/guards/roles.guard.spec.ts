import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../roles';

// Tạo ExecutionContext giả với roles yêu cầu (metadata) + roles của user (req.user).
function makeCtx(required: Role[] | undefined, userRoles: string[]): {
  ctx: ExecutionContext;
  reflector: Reflector;
} {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  } as unknown as Reflector;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: { roles: userRoles } }) }),
  } as unknown as ExecutionContext;
  return { ctx, reflector };
}

describe('RolesGuard (RBAC, Backend §4)', () => {
  it('không yêu cầu vai trò → cho qua', () => {
    const { ctx, reflector } = makeCtx(undefined, []);
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('user có đúng vai trò yêu cầu → cho qua', () => {
    const { ctx, reflector } = makeCtx([Role.REVIEWER], [Role.REVIEWER]);
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('user thiếu vai trò → AUTH-003 (Forbidden)', () => {
    const { ctx, reflector } = makeCtx([Role.REVIEWER], [Role.COMMUNE_USER]);
    expect(() => new RolesGuard(reflector).canActivate(ctx)).toThrow(
      ForbiddenException,
    );
  });

  it('SYS_ADMIN là superuser → đi qua MỌI @Roles kể cả không nằm trong danh sách', () => {
    // Endpoint chỉ cho COMMUNE_USER/BARRACKS_OFFICER, nhưng admin vẫn qua được.
    const { ctx, reflector } = makeCtx(
      [Role.COMMUNE_USER, Role.BARRACKS_OFFICER],
      [Role.SYS_ADMIN],
    );
    expect(new RolesGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('user thường (không admin) vẫn bị chặn khi thiếu quyền', () => {
    const { ctx, reflector } = makeCtx([Role.PROVINCIAL_COMMAND], [Role.REPORT_VIEWER]);
    expect(() => new RolesGuard(reflector).canActivate(ctx)).toThrow(
      'AUTH-003',
    );
  });
});
