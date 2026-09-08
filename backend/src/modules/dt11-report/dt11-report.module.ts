import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportDefinition, ReportTemplateVersion } from './entities/report-definition.entity';
import { DatasetDefinition, DatasetField, DatasetFilter, DatasetFormula } from './entities/dataset-definition.entity';
import { DatasetInstance, DatasetValidation } from './entities/dataset-instance.entity';
import { ReportInstance } from './entities/report-instance.entity';
import { ReportRollup } from './entities/report-rollup.entity';
import { ReportLineage } from './entities/report-lineage.entity';
import { OfficialSnapshot, OfficialSnapshotLine } from '../dt10-inventory-count/entities/official-snapshot.entity';
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from '../dt09-balance/entities/balance-snapshot.entity';
import { CalculationRun } from '../dt08-calculation/entities/calculation-run.entity';
import { MaterialCalculation } from '../dt08-calculation/entities/material-calculation.entity';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';

// DT-11 — Report Engine (Quyển XI). Đọc snapshot chuẩn của DT-04/08/09/10 (chỉ đọc — bất biến) làm dataset;
// render file phát hành qua StorageService (MinIO + checksum sha256).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReportDefinition,
      ReportTemplateVersion,
      DatasetDefinition,
      DatasetField,
      DatasetFilter,
      DatasetFormula,
      DatasetInstance,
      DatasetValidation,
      ReportInstance,
      ReportRollup,
      ReportLineage,
      // Nguồn snapshot chuẩn (chỉ đọc):
      OfficialSnapshot,
      OfficialSnapshotLine,
      MaterielSnapshot,
      MaterielSnapshotLine,
      BalanceSnapshot,
      BalanceSnapshotLine,
      CalculationRun,
      MaterialCalculation,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class Dt11ReportModule {}
