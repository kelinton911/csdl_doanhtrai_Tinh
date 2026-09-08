import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiDefinition, KpiFormulaVersion } from './entities/kpi-definition.entity';
import { KpiThreshold } from './entities/kpi-threshold.entity';
import { MetricInstance } from './entities/metric-instance.entity';
import { DataMartRefresh } from './entities/data-mart-refresh.entity';
import { DimLocation, DimMaterial, DimMission, DimOrg, DimQuality, DimTime, FactBalance, FactCount, FactInventory, FactRequirement } from './entities/data-mart.entity';
import { AlertRule, AlertInstance, AlertAssignment } from './entities/alert-rule.entity';
import { DecisionSession, DecisionOption, DecisionCriterion, DecisionScore, DecisionRecord } from './entities/decision.entity';
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';
import { AllocationHold } from '../dt06-allocation/entities/allocation-hold.entity';
import { AllocationSnapshot, AllocationSnapshotLine } from '../dt06-allocation/entities/allocation-snapshot.entity';
import { CalculationRun } from '../dt08-calculation/entities/calculation-run.entity';
import { MaterialCalculation } from '../dt08-calculation/entities/material-calculation.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from '../dt09-balance/entities/balance-snapshot.entity';
import { OfficialSnapshot, OfficialSnapshotLine } from '../dt10-inventory-count/entities/official-snapshot.entity';
import { Dt12Service } from './dt12.service';
import { Dt12Controller } from './dt12.controller';

// DT-12 — Dashboard chỉ huy (Quyển XII). Lớp semantic/KPI + Data Mart (dẫn xuất) đọc SNAPSHOT CHUẨN của
// DT-04/06/08/09/10 (chỉ đọc — bất biến); metric có as_of_time + lineage + freshness; alert lifecycle + SLA;
// decision what-if cách ly. Không tạo "số Dashboard" độc lập (AC-15). OutboxService là @Global.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      // Bảng DT-12
      KpiDefinition,
      KpiFormulaVersion,
      KpiThreshold,
      MetricInstance,
      DataMartRefresh,
      DimTime,
      DimMaterial,
      DimOrg,
      DimLocation,
      DimMission,
      DimQuality,
      FactInventory,
      FactRequirement,
      FactBalance,
      FactCount,
      AlertRule,
      AlertInstance,
      AlertAssignment,
      DecisionSession,
      DecisionOption,
      DecisionCriterion,
      DecisionScore,
      DecisionRecord,
      // Nguồn snapshot chuẩn (chỉ đọc)
      MaterielSnapshot,
      MaterielSnapshotLine,
      AllocationHold,
      AllocationSnapshot,
      AllocationSnapshotLine,
      CalculationRun,
      MaterialCalculation,
      BalanceSnapshot,
      BalanceSnapshotLine,
      OfficialSnapshot,
      OfficialSnapshotLine,
    ]),
  ],
  controllers: [Dt12Controller],
  providers: [Dt12Service],
  exports: [Dt12Service],
})
export class Dt12DashboardModule {}
