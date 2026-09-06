import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'require_permission';

export interface RequirePermissionOptions {
  // Tên tham số chứa organizationId để kiểm tra scope UNIT (ưu tiên params → body → query).
  orgParam?: string;
  // Tên tham số chứa id chủ sở hữu tài nguyên để kiểm tra scope SELF.
  ownerParam?: string;
}

export interface RequirePermissionMeta extends RequirePermissionOptions {
  functionCode: string;
}

// Yêu cầu quyền theo mã chức năng (RBAC Position–Function). Chạy song song @Roles.
// Vd: @RequirePermission('BARRACKS_UPDATE', { orgParam: 'organizationId' })
export const RequirePermission = (
  functionCode: string,
  options: RequirePermissionOptions = {},
) => SetMetadata(PERMISSION_KEY, { functionCode, ...options } as RequirePermissionMeta);
