import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

// Dashboard chỉ huy — đọc tổng hợp trực tiếp từ CSDL (DataSource dùng chung).
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
