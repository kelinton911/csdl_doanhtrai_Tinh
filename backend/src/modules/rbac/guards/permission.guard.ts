import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  PERMISSION_KEY,
  RequirePermissionMeta,
} from '../../../common/decorators/require-permission.decorator';
import { Role } from '../../identity/roles';
import { AuthorizationService, AuthzUser } from '../authorization.service';

// Guard kiểm tra quyền theo mã chức năng (RBAC Position–Function).
// - Endpoint KHÔNG gắn @RequirePermission → bỏ qua (tương thích ngược, chuyển dần từng module).
// - SYS_ADMIN: cửa cứu hộ (giống RolesGuard) để tránh khóa nhầm quản trị khi rollout dở dang.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<RequirePermissionMeta | undefined>(
      PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!meta) return true; // Không yêu cầu quyền cụ thể.

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthzUser }>();
    const user = req.user;

    // Cửa cứu hộ: SYS_ADMIN đi qua (data-scope toàn tỉnh). Seed backfill sẽ cấp Position tương ứng.
    if (user?.roles?.includes(Role.SYS_ADMIN)) return true;

    const context = {
      organizationId: meta.orgParam ? this.pick(req, meta.orgParam) : undefined,
      resourceOwnerId: meta.ownerParam ? this.pick(req, meta.ownerParam) : undefined,
    };

    const result = await this.authz.authorize(user, meta.functionCode, context);
    if (!result.allowed) {
      throw new ForbiddenException(`AUTH-003: ${result.deniedReason}`);
    }
    return true;
  }

  // Lấy giá trị tham số theo thứ tự params → body → query.
  private pick(req: Request, name: string): string | undefined {
    const p = (req.params as Record<string, unknown>)?.[name];
    if (typeof p === 'string') return p;
    const b = (req.body as Record<string, unknown>)?.[name];
    if (typeof b === 'string') return b;
    const q = (req.query as Record<string, unknown>)?.[name];
    if (typeof q === 'string') return q;
    return undefined;
  }
}
