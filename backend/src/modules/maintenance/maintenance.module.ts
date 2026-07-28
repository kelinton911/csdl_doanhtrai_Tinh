import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DamageEvent } from './entities/damage-event.entity';
import { MaintenanceRequest } from './entities/maintenance-request.entity';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';

// M09 — Maintenance & Recovery: hư hỏng + yêu cầu sửa chữa/khôi phục.
@Module({
  imports: [TypeOrmModule.forFeature([DamageEvent, MaintenanceRequest])],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
