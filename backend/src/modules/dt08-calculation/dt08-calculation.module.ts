import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalculationScenario } from './entities/calculation-scenario.entity';
import { CalculationRun } from './entities/calculation-run.entity';
import { MaterialCalculation } from './entities/material-calculation.entity';
import { RuleResolutionSnapshot } from './entities/rule-resolution-snapshot.entity';
import { HcSnapshotRef } from './entities/hc-snapshot-ref.entity';
import { CalculationTraceNode } from './entities/calculation-trace-node.entity';
import { ScenarioComparison } from './entities/scenario-comparison.entity';
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';
import { CalcService } from './calc.service';
import { CalcController } from './calc.controller';
import { Dt07NormsModule } from '../dt07-norms/dt07-norms.module';
import { Dt06AllocationModule } from '../dt06-allocation/dt06-allocation.module';

// DT-08 — Engine tính nhu cầu NC = TT + PC_SSCĐ − HC. Gọi DT-07 (resolve định mức),
// DT-06 (PC_SSCĐ), đọc HC as-of từ hc_snapshot DT-04. supply_required → DT-09.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CalculationScenario, CalculationRun, MaterialCalculation, RuleResolutionSnapshot,
      HcSnapshotRef, CalculationTraceNode, ScenarioComparison,
      MaterielSnapshot, MaterielSnapshotLine,
    ]),
    Dt07NormsModule, // NormsService.resolve (định mức deterministic)
    Dt06AllocationModule, // AllocationService.reserveSscd (PC_SSCĐ)
  ],
  controllers: [CalcController],
  providers: [CalcService],
  exports: [CalcService],
})
export class Dt08CalculationModule {}
