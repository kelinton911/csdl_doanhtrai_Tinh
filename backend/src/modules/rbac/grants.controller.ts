import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GrantsService } from './grants.service';
import { CreateGrantDto, RevokeGrantDto } from './dto/grant.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import {
  CurrentUser,
  AuthUser,
} from '../../common/decorators/current-user.decorator';

// M01-RBAC — Cấp/thu hồi quyền lẻ. Chỉ SYS_ADMIN.
@ApiTags('RBAC — Chức vụ & phân quyền (M01)')
@ApiBearerAuth()
@Roles(Role.SYS_ADMIN)
@Controller('rbac/permission-grants')
export class GrantsController {
  constructor(private readonly service: GrantsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách quyền cấp lẻ của một tài khoản' })
  listByUser(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.service.listByUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Cấp quyền lẻ cho tài khoản' })
  create(@Body() dto: CreateGrantDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.sub);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Thu hồi quyền lẻ' })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeGrantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.revoke(id, dto, user.sub);
  }
}
