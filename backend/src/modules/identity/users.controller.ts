import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  AssignRolesDto,
  AssignScopesDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
} from './dto/user.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from './roles';

// UC-02 — Quản lý người dùng, vai trò, phạm vi dữ liệu. Chỉ SYS_ADMIN.
@ApiTags('Identity & Access (M01)')
@ApiBearerAuth()
@Roles(Role.SYS_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'UC-02: Danh sách người dùng' })
  list(@Query() q: PaginationQuery) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'UC-02: Chi tiết người dùng' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'UC-02: Tạo tài khoản' })
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'UC-02: Cập nhật tài khoản (không xóa cứng — dùng khóa)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/roles')
  @ApiOperation({ summary: 'UC-02: Gán vai trò' })
  roles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignRolesDto) {
    return this.service.assignRoles(id, dto);
  }

  @Post(':id/scopes')
  @ApiOperation({ summary: 'UC-02: Gán phạm vi dữ liệu' })
  scopes(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignScopesDto) {
    return this.service.assignScopes(id, dto);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'UC-02: Đặt lại mật khẩu và mở khóa tài khoản' })
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(id, dto);
  }
}
