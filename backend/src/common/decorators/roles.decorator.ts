import { SetMetadata } from '@nestjs/common';
import { Role } from '../../modules/identity/roles';

export const ROLES_KEY = 'roles';
// Giới hạn endpoint theo vai trò RBAC.
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
