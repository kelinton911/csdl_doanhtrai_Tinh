import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportJob } from './report-job.entity';
import { ReportingService } from './reporting.service';
import { ReportingController } from './reporting.controller';

// M12 — Reporting & Analytics + Search.
@Module({
  imports: [TypeOrmModule.forFeature([ReportJob])],
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
