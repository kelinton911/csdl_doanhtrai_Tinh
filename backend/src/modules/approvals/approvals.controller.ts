import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// Hàng chờ duyệt gộp cho người có quyền duyệt (chỉ huy xã / Ban doanh trại Tỉnh).
@ApiTags('Approvals')
@ApiBearerAuth()
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get()
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Danh sách hồ sơ đang chờ duyệt (doanh trại + kho trạm)' })
  pending(@CurrentUser() user: AuthUser) {
    return this.service.pending(user);
  }
}
