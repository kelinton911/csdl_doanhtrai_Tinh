import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InspectionCampaign } from './entities/inspection-campaign.entity';
import { InspectionSheet } from './entities/inspection-sheet.entity';
import { InspectionLine } from './entities/inspection-line.entity';
import { ReviewTask } from './entities/review-task.entity';
import { InspectionService } from './inspection.service';
import { InspectionController } from './inspection.controller';

// M07 — Inspection & Review: đợt kiểm kê, phiếu, dòng, chênh lệch, kiểm duyệt.
@Module({
  imports: [
    TypeOrmModule.forFeature([InspectionCampaign, InspectionSheet, InspectionLine, ReviewTask]),
  ],
  controllers: [InspectionController],
  providers: [InspectionService],
  exports: [InspectionService],
})
export class InspectionModule {}
