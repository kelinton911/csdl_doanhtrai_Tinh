import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard & Reporting (M12)')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp KPI + biểu đồ cho dashboard chỉ huy (theo chế độ)' })
  @ApiQuery({ name: 'mode', required: false, enum: ['NORMAL', 'SSCD', 'SCENARIO'] })
  summary(@Query('mode') mode?: string) {
    return this.service.summary(mode);
  }

  @Get('potential-by-area')
  @ApiOperation({ summary: 'Tổng hợp tiềm lực HC-KT theo địa bàn (xã/phường/đặc khu)' })
  potentialByArea() {
    return this.service.potentialByArea();
  }
}
