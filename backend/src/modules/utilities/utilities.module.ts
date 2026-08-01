import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilitySystem } from './entities/utility-system.entity';
import { UtilityReading } from './entities/utility-reading.entity';
import { UtilitiesService } from './utilities.service';
import { UtilitiesController } from './utilities.controller';

// M11 — Điện/Nước/Năng lượng (hệ thống hạ tầng kỹ thuật + chỉ số tiêu thụ).
@Module({
  imports: [TypeOrmModule.forFeature([UtilitySystem, UtilityReading])],
  controllers: [UtilitiesController],
  providers: [UtilitiesService],
  exports: [UtilitiesService],
})
export class UtilitiesModule {}
