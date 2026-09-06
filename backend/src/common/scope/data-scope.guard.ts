import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../decorators/current-user.decorator';
import { SCOPED_KEY } from './scope.decorator';
import {
  ScopeContext,
  ScopeDimension,
  assertWithinScope,
  buildScopeContext,
} from './scope-context';

// Tên field theo từng chiều phạm vi (chấp nhận cả camelCase lẫn snake_case).
const FIELD_MAP: Record<ScopeDimension, string[]> = {
  organization: ['organizationId', 'organization_id'],
  area: ['areaId', 'area_id'],
  mission: ['missionId', 'mission_id'],
};

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

interface ScopedRequest {
  method: string;
  user?: AuthUser;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  scope?: ScopeContext;
}

// Guard row-level toàn cục (SYS-BR-08). Với handler gắn @Scoped(...):
//  1. Dựng ScopeContext từ token, gắn vào req.scope để service tái dùng.
//  2. Đối chiếu mọi giá trị scope trong params/query/body (kể cả body ghi đè
//     organization_id) với phạm vi được giao. Vượt phạm vi → 403 NO_PERMISSION_SCOPE.
// province-wide đi qua tất cả; user chưa gán scope → danh sách rỗng (mặc định hạn chế).
@Injectable()
export class DataScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const dims = this.reflector.getAllAndOverride<ScopeDimension[]>(SCOPED_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest<ScopedRequest>();
    // Luôn gắn scope context (kể cả khi không @Scoped) để service dùng khi cần.
    const scope = buildScopeContext(req.user);
    req.scope = scope;

    if (!dims || dims.length === 0) return true;
    if (scope.provinceWide) return true;

    const bags: Array<Record<string, unknown> | undefined> = [req.params, req.query];
    if (MUTATING.has(req.method)) bags.push(req.body);

    for (const dim of dims) {
      const fields = FIELD_MAP[dim];
      for (const bag of bags) {
        if (!bag) continue;
        for (const f of fields) {
          const raw = bag[f];
          if (raw === undefined || raw === null || raw === '') continue;
          const values = Array.isArray(raw) ? raw : [raw];
          for (const v of values) {
            assertWithinScope(scope, dim, String(v));
          }
        }
      }
    }
    return true;
  }
}
