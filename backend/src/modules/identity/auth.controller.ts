import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Identity & Access (M01)')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'UC-01: Đăng nhập và tạo phiên truy cập' })
  login(@Body() dto: LoginDto) {
    return this.auth.validateAndLogin(dto.username, dto.password);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'UC-01: Làm mới phiên bằng refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Thông tin quyền/phạm vi của phiên hiện tại' })
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.sub,
      username: user.username,
      roles: user.roles,
      organizationId: user.organizationId,
    };
  }
}
