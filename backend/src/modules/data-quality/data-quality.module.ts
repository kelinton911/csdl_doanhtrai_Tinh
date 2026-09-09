import { Module } from '@nestjs/common';
import { DataQualityController } from './data-quality.controller';
import { DataQualityService } from './data-quality.service';

// §6 Hardening — DQ toàn hệ (đọc-only, tái dùng DataSource; không thêm bảng).
@Module({
  controllers: [DataQualityController],
  providers: [DataQualityService],
})
export class DataQualityModule {}
