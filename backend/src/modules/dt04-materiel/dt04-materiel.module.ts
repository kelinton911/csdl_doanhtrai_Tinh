import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryLot } from './entities/inventory-lot.entity';
import { AssetInstance } from './entities/asset-instance.entity';
import { MaterielMovement } from './entities/materiel-movement.entity';
import { MaterielSnapshot } from './entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from './entities/materiel-snapshot-line.entity';
import { QualityAssessment } from './entities/quality-assessment.entity';
import { InventoryAdjustmentRequest } from './entities/inventory-adjustment-request.entity';
import { MaterielService } from './materiel.service';
import { MaterielController } from './materiel.controller';

// DT-04 — Thực lực vật chất (sổ cái bất biến + HC theo thời điểm + snapshot + điều chỉnh).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryLot, AssetInstance, MaterielMovement, MaterielSnapshot,
      MaterielSnapshotLine, QualityAssessment, InventoryAdjustmentRequest,
    ]),
  ],
  controllers: [MaterielController],
  providers: [MaterielService],
  exports: [MaterielService],
})
export class Dt04MaterielModule {}
