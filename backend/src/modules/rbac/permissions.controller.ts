import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthorizationService } from './authorization.service';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

// Quyền hiệu lực của phiên hiện tại — để FE ẩn/hiện menu và nút theo chức năng.
// Server vẫn là nơi thực thi thật; đây chỉ phục vụ hiển thị.
@ApiTags('RBAC — Chức vụ & phân quyền (M01)')
@ApiBearerAuth()
@Controller('me')
export class PermissionsController {
  constructor(private readonly authz: AuthorizationService) {}

  @Get('permissions')
  @ApiOperation({ summary: 'Danh sách chức năng + scope hiệu lực của tài khoản hiện tại' })
  async myPermissions(@CurrentUser() user: AuthUser) {
    const perms = await this.authz.getUserPermissions(user.sub);
    return {
      userId: user.sub,
      roles: user.roles,
      permissions: [...perms.values()],
    };
  }
}
