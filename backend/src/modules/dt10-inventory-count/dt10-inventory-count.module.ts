import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryCountCampaign } from './entities/inventory-count-campaign.entity';
import { BookSnapshot, BookSnapshotLine } from './entities/book-snapshot.entity';
import { CountSheet, CountLine } from './entities/count-sheet.entity';
import { RecountRound } from './entities/recount-round.entity';
import { CountVariance } from './entities/count-variance.entity';
import { CountQualityGrade } from './entities/count-quality-grade.entity';
import { OfficialSnapshot, OfficialSnapshotLine, OfficialLock } from './entities/official-snapshot.entity';
import { CountAdjustmentRequest } from './entities/count-adjustment-request.entity';
import { ReportDataset } from './entities/report-dataset.entity';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { StockQualityDetail } from '../inventory/entities/stock-quality-detail.entity';
import { CountService } from './count.service';
import { CountController } from './count.controller';
import { Dt05DocumentsModule } from '../dt05-documents/dt05-documents.module';

// DT-10 — Kiểm kê & chốt số liệu (Quyển X). Dựng book_snapshot từ sổ cái DT-04 (MaterielMovement) +
// chất lượng C1–5 (StockQualityDetail); điều chỉnh đi qua DT-05 (DocumentsService — CONVERSION).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryCountCampaign,
      BookSnapshot, BookSnapshotLine,
      CountSheet, CountLine,
      RecountRound,
      CountVariance,
      CountQualityGrade,
      OfficialSnapshot, OfficialSnapshotLine, OfficialLock,
      CountAdjustmentRequest,
      ReportDataset,
      MaterielMovement, // đọc sổ cái DT-04 để dựng book_snapshot tại cutoff
      StockQualityDetail, // chất lượng C1–5 tại cutoff (module inventory)
    ]),
    Dt05DocumentsModule, // DocumentsService.createDocument (điều chỉnh → chứng từ DT-05)
  ],
  controllers: [CountController],
  providers: [CountService],
  exports: [CountService],
})
export class Dt10InventoryCountModule {}
