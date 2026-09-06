import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllocationType } from './entities/allocation-type.entity';
import { InventoryAllocation } from './entities/inventory-allocation.entity';
import { AllocationLine } from './entities/allocation-line.entity';
import { AllocationHold } from './entities/allocation-hold.entity';
import { ReserveRequirementLink } from './entities/reserve-requirement-link.entity';
import { AllocationSnapshot, AllocationSnapshotLine } from './entities/allocation-snapshot.entity';
import { AllocationChangeRequest } from './entities/allocation-change-request.entity';
import { SlowMovingRule, SlowMovingEvaluation } from './entities/slow-moving.entity';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { AllocationService } from './allocation.service';
import { AllocationController } from './allocation.controller';

// DT-06 — Dự trữ & phân bổ. Lớp phủ ngữ nghĩa trên HC (DT-04); cấp PC_SSCĐ cho DT-08.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AllocationType, InventoryAllocation, AllocationLine, AllocationHold, ReserveRequirementLink,
      AllocationSnapshot, AllocationSnapshotLine, AllocationChangeRequest, SlowMovingRule, SlowMovingEvaluation,
      MaterielMovement,
    ]),
  ],
  controllers: [AllocationController],
  providers: [AllocationService],
  exports: [AllocationService],
})
export class Dt06AllocationModule {}
