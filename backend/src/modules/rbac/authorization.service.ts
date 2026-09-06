import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserPosition } from './entities/user-position.entity';
import { PositionFunction } from './entities/position-function.entity';
import { AppFunction } from './entities/app-function.entity';
import { UserPermissionGrant } from './entities/user-permission-grant.entity';
import { FUNCTION_SCOPE_RANK, FunctionScope } from './rbac.enums';

// Người dùng đã xác thực (payload JWT gắn vào request).
export interface AuthzUser {
  sub: string;
  username?: string;
  roles?: string[];
  organizationId?: string | null;
  dataScopes?: Array<{ type: string; refId: string }>;
}

// Ngữ cảnh tài nguyên để kiểm tra scope.
export interface AuthzContext {
  organizationId?: string | null;
  resourceOwnerId?: string | null;
}

export interface AuthzResult {
  allowed: boolean;
  scope?: FunctionScope;
  deniedReason?: string;
}

// Một quyền hiệu lực: mã chức năng + scope rộng nhất + nguồn (chức vụ / cấp lẻ).
export interface EffectivePermission {
  functionCode: string;
  scope: FunctionScope;
  source: 'POSITION' | 'GRANT';
}

interface CacheEntry {
  perms: Map<string, EffectivePermission>;
  expiresAt: number;
}

// Engine phân quyền RBAC theo Chức vụ–Chức năng. FAIL-CLOSED: thiếu quyền/lỗi → từ chối.
// Cache theo userId (TTL ngắn) để tránh truy vấn mỗi request; tự làm mới khi bổ nhiệm/cấp quyền đổi.
@Injectable()
export class AuthorizationService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly cacheTtlMs = 60_000; // 60s

  constructor(
    @InjectRepository(UserPosition)
    private readonly userPositions: Repository<UserPosition>,
    @InjectRepository(PositionFunction)
    private readonly positionFunctions: Repository<PositionFunction>,
    @InjectRepository(AppFunction)
    private readonly functions: Repository<AppFunction>,
    @InjectRepository(UserPermissionGrant)
    private readonly grants: Repository<UserPermissionGrant>,
  ) {}

  // Xóa cache quyền của 1 user (gọi khi thay đổi bổ nhiệm/ma trận/ cấp quyền).
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  // Xóa toàn bộ cache (khi đổi ma trận position_functions ảnh hưởng nhiều user).
  invalidateAll(): void {
    this.cache.clear();
  }

  // Tập quyền hiệu lực của user: hợp của (chức năng qua chức vụ đang hiệu lực) + (cấp quyền lẻ còn hạn).
  async getUserPermissions(userId: string): Promise<Map<string, EffectivePermission>> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.perms;

    const now = new Date();
    const perms = new Map<string, EffectivePermission>();

    // 1) Quyền theo chức vụ: user_positions (đang hiệu lực) → position_functions → functions.
    const positions = (
      await this.userPositions.find({ where: { userId, isActive: true } })
    ).filter((p) => !p.endDate || p.endDate > now);
    const positionIds = positions.map((p) => p.positionId);

    if (positionIds.length > 0) {
      const pfs = await this.positionFunctions.find({
        where: { positionId: In(positionIds), isActive: true },
      });
      const functionIds = [...new Set(pfs.map((pf) => pf.functionId))];
      if (functionIds.length > 0) {
        const fns = await this.functions.find({
          where: { id: In(functionIds), isActive: true },
        });
        const idToCode = new Map(fns.map((f) => [f.id, f.code]));
        for (const pf of pfs) {
          const code = idToCode.get(pf.functionId);
          if (!code) continue; // function bị vô hiệu hóa → bỏ qua
          this.addPermission(perms, code, pf.scope as FunctionScope, 'POSITION');
        }
      }
    }

    // 2) Quyền cấp lẻ: user_permission_grants còn hạn, chưa thu hồi.
    const activeGrants = (
      await this.grants.find({ where: { userId, isRevoked: false } })
    ).filter((g) => !g.expiresAt || g.expiresAt > now);
    for (const g of activeGrants) {
      this.addPermission(perms, g.functionCode, g.scope as FunctionScope, 'GRANT');
    }

    this.cache.set(userId, { perms, expiresAt: Date.now() + this.cacheTtlMs });
    return perms;
  }

  // Thêm quyền; nếu đã có thì giữ scope rộng hơn.
  private addPermission(
    perms: Map<string, EffectivePermission>,
    functionCode: string,
    scope: FunctionScope,
    source: 'POSITION' | 'GRANT',
  ): void {
    const existing = perms.get(functionCode);
    if (!existing || FUNCTION_SCOPE_RANK[scope] > FUNCTION_SCOPE_RANK[existing.scope]) {
      perms.set(functionCode, { functionCode, scope, source });
    }
  }

  // Hàm chính: kiểm tra quyền. FAIL-CLOSED.
  async authorize(
    user: AuthzUser | null | undefined,
    functionCode: string,
    context: AuthzContext = {},
  ): Promise<AuthzResult> {
    if (!user || !user.sub) {
      return { allowed: false, deniedReason: 'Vui lòng đăng nhập để thực hiện thao tác này' };
    }
    try {
      const perms = await this.getUserPermissions(user.sub);
      const entry = perms.get(functionCode);
      if (!entry) {
        return {
          allowed: false,
          deniedReason: `Bạn không có quyền thực hiện chức năng: ${functionCode}`,
        };
      }
      const scopeOk = this.checkScope(entry.scope, user, context);
      if (!scopeOk.allowed) {
        return { allowed: false, deniedReason: scopeOk.reason };
      }
      return { allowed: true, scope: entry.scope };
    } catch (err) {
      // FAIL-CLOSED: lỗi hệ thống → từ chối (không allow mặc định).
      console.error('[RBAC] Lỗi kiểm tra quyền:', err);
      return { allowed: false, deniedReason: 'Lỗi kiểm tra quyền. Vui lòng thử lại.' };
    }
  }

  // Kiểm tra phạm vi dữ liệu theo scope so với ngữ cảnh và phạm vi của user.
  private checkScope(
    scope: FunctionScope,
    user: AuthzUser,
    ctx: AuthzContext,
  ): { allowed: boolean; reason?: string } {
    switch (scope) {
      case FunctionScope.ALL:
      case FunctionScope.PROVINCE:
        // Hệ thống một tỉnh: PROVINCE và ALL đều cho phép trên toàn phạm vi tỉnh.
        return { allowed: true };

      case FunctionScope.UNIT: {
        // Không xác định được đơn vị của tài nguyên → để tầng service lọc theo dataScopes.
        if (!ctx.organizationId) return { allowed: true };
        const scopeIds = new Set(
          (user.dataScopes ?? [])
            .filter((s) => s.type === 'ORGANIZATION')
            .map((s) => s.refId),
        );
        if (user.organizationId) scopeIds.add(user.organizationId);
        if (scopeIds.has(ctx.organizationId)) return { allowed: true };
        return { allowed: false, reason: 'Ngoài phạm vi đơn vị được phân công' };
      }

      case FunctionScope.SELF: {
        // Không xác định được chủ sở hữu → cho phép (vd endpoint "hồ sơ của tôi").
        if (!ctx.resourceOwnerId) return { allowed: true };
        if (ctx.resourceOwnerId === user.sub) return { allowed: true };
        return { allowed: false, reason: 'Chỉ được thao tác trên dữ liệu của chính mình' };
      }

      default:
        return { allowed: false, reason: 'Scope không hợp lệ' };
    }
  }
}
