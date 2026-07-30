import { Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';

// Hàng chờ duyệt gộp — đọc trực tiếp qua DataSource (không sở hữu bảng riêng).
@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
})
export class ApprovalsModule {}
