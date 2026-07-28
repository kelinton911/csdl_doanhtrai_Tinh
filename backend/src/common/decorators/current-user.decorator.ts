import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface DataScope {
  type: string; // ORGANIZATION | AREA
  refId: string;
}

export interface AuthUser {
  sub: string;
  username: string;
  roles: string[];
  organizationId: string | null;
  dataScopes?: DataScope[];
}

// Lấy người dùng đã xác thực từ request (do JwtAuthGuard gắn vào).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
