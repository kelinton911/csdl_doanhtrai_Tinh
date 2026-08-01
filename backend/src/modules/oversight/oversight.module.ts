import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inspection } from './entities/inspection.entity';
import { InspectionFinding } from './entities/inspection-finding.entity';
import { OversightService } from './oversight.service';
import { OversightController } from './oversight.controller';

// M22 — Kiểm tra, thanh tra & xử lý kiến nghị.
@Module({
  imports: [TypeOrmModule.forFeature([Inspection, InspectionFinding])],
  controllers: [OversightController],
  providers: [OversightService],
  exports: [OversightService],
})
export class OversightModule {}
