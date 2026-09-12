import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Dashboard & Reporting (M12)')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp KPI + biểu đồ cho dashboard chỉ huy (theo chế độ)' })
  @ApiQuery({ name: 'mode', required: false, enum: ['NORMAL', 'SSCD', 'SCENARIO'] })
  summary(@CurrentUser() user: AuthUser, @Query('mode') mode?: string) {
    return this.service.summary(mode, user);
  }

  @Get('potential-by-area')
  @ApiOperation({ summary: 'Tổng hợp tiềm lực HC-KT theo địa bàn (xã/phường/đặc khu)' })
  potentialByArea() {
    return this.service.potentialByArea();
  }

  @Get('commune-readiness')
  @ApiOperation({ summary: 'M15: So sánh mức hoàn chỉnh & độ tươi hồ sơ doanh trại giữa các xã' })
  @ApiQuery({ name: 'staleDays', required: false, description: 'Ngưỡng chưa cập nhật (mặc định 90)' })
  communeReadiness(@CurrentUser() user: AuthUser, @Query('staleDays') staleDays?: string) {
    return this.service.communeReadiness(staleDays, user);
  }

  @Get('command')
  @ApiOperation({ summary: 'M23: Toàn cảnh chỉ huy cấp tỉnh — tổng hợp mọi trụ cột dữ liệu' })
  commandOverview() {
    return this.service.commandOverview();
  }
}
