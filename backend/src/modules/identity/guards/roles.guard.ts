import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';
import { Role } from '../roles';

// Kiểm tra vai trò RBAC. AUTH-003 nếu ngoài phạm vi quyền.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const userRoles: string[] = req.user?.roles ?? [];
    const ok = required.some((r) => userRoles.includes(r));
    if (!ok) {
      throw new ForbiddenException('AUTH-003: Ngoài phạm vi quyền');
    }
    return true;
  }
}
