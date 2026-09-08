// Seed DT-12 (Quyển XII). Nạp 7 KPI (mỗi semantic 1 KPI) + formula_version ACTIVE + threshold + alert_rule
// dưới dạng CẤU HÌNH (không hard-code trong engine). Kèm DỮ LIỆU NGUỒN DEMO (materiel snapshot DT-04 +
// allocation_hold DT-06 + calculation_run DT-08 + balance_snapshot DT-09) id cố định để webapp/E2E resolve
// đủ 7 semantic, drill-down và sinh cảnh báo. Idempotent theo kpi_code/rule_code/snapshotCode/scenarioId/planId.
import 'reflect-metadata';
import dataSource from '../data-source';
import { KpiDefinition, KpiFormulaVersion } from '../../modules/dt12-dashboard/entities/kpi-definition.entity';
import { KpiThreshold } from '../../modules/dt12-dashboard/entities/kpi-threshold.entity';
import { AlertRule } from '../../modules/dt12-dashboard/entities/alert-rule.entity';
import {
  KpiDefinitionStatus,
  KpiFormulaVersionStatus,
  Semantic,
  ThresholdDirection,
} from '../../modules/dt12-dashboard/dt12.enums';
import { MaterielSnapshot } from '../../modules/dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../../modules/dt04-materiel/entities/materiel-snapshot-line.entity';
import { AllocationHold } from '../../modules/dt06-allocation/entities/allocation-hold.entity';
import { AllocationCategory, AllocationSemantics, HoldStatus } from '../../modules/dt06-allocation/alloc-rules';
import { CalculationRun } from '../../modules/dt08-calculation/entities/calculation-run.entity';
import { MaterialCalculation } from '../../modules/dt08-calculation/entities/material-calculation.entity';
import { CalculationRunStatus } from '../../modules/dt08-calculation/calc-rules';
import { BalanceSnapshot, BalanceSnapshotLine } from '../../modules/dt09-balance/entities/balance-snapshot.entity';

// ID cố định demo DT-12.
export const DT12_DEMO_ORG_ID = '00000000-0000-0000-0000-0000000d1200';
export const DT12_DEMO_MAT1 = '00000000-0000-0000-0000-0000000d1201';
export const DT12_DEMO_MAT2 = '00000000-0000-0000-0000-0000000d1202';
const DT12_DEMO_SCENARIO_ID = '00000000-0000-0000-0000-0000000d1203';
const DT12_DEMO_PLAN_ID = '00000000-0000-0000-0000-0000000d1204';
const DT12_DEMO_ALLOC_ID = '00000000-0000-0000-0000-0000000d1205';
const DT12_MATERIEL_SNAPSHOT_CODE = 'DT12-DEMO-MAT';

interface KpiSpec {
  kpiCode: string;
  name: string;
  semantic: Semantic;
  unit: string;
  threshold?: { warn?: number; critical?: number; direction: ThresholdDirection };
}

// 7 KPI — mỗi semantic một KPI (semantic_ref). Ngưỡng: GAP/NC càng cao càng xấu; HC/HC-AVAILABLE càng thấp càng xấu.
const KPIS: KpiSpec[] = [
  { kpiCode: 'KPI-HC', name: 'Hiện có (HC)', semantic: Semantic.SEM_HC, unit: 'đơn vị', threshold: { warn: 100, critical: 50, direction: ThresholdDirection.LOWER_WORSE } },
  { kpiCode: 'KPI-HC-AVAILABLE', name: 'Khả dụng (HC-AVAILABLE)', semantic: Semantic.SEM_HC_AVAILABLE, unit: 'đơn vị', threshold: { warn: 200, critical: 100, direction: ThresholdDirection.LOWER_WORSE } },
  { kpiCode: 'KPI-RESERVE-SSCD', name: 'Dự trữ SSCĐ', semantic: Semantic.SEM_RESERVE_SSCD, unit: 'đơn vị' },
  { kpiCode: 'KPI-PC-SCD', name: 'Phân cấp SSCĐ (PC_SSCĐ)', semantic: Semantic.SEM_PC_SCD, unit: 'đơn vị' },
  { kpiCode: 'KPI-NC', name: 'Nhu cầu (NC)', semantic: Semantic.SEM_NC, unit: 'đơn vị', threshold: { warn: 20, critical: 50, direction: ThresholdDirection.HIGHER_WORSE } },
  { kpiCode: 'KPI-SUPPLY-REQUIRED', name: 'Cần bảo đảm', semantic: Semantic.SEM_SUPPLY_REQUIRED, unit: 'đơn vị' },
  { kpiCode: 'KPI-GAP', name: 'Thiếu hụt (GAP)', semantic: Semantic.SEM_GAP, unit: 'đơn vị', threshold: { warn: 5, critical: 8, direction: ThresholdDirection.HIGHER_WORSE } },
];

async function run() {
  await dataSource.initialize();
  const kpiRepo = dataSource.getRepository(KpiDefinition);
  const fvRepo = dataSource.getRepository(KpiFormulaVersion);
  const thRepo = dataSource.getRepository(KpiThreshold);
  const ruleRepo = dataSource.getRepository(AlertRule);

  // 1) KPI + formula_version ACTIVE + threshold
  for (const spec of KPIS) {
    let kpi = await kpiRepo.findOne({ where: { kpiCode: spec.kpiCode } });
    if (!kpi) {
      kpi = await kpiRepo.save(
        kpiRepo.create({
          kpiCode: spec.kpiCode,
          name: spec.name,
          semanticRef: spec.semantic,
          unit: spec.unit,
          status: KpiDefinitionStatus.ACTIVE,
          currentVersionNo: 1,
        }),
      );
      await fvRepo.save(fvRepo.create({ kpiDefinitionId: kpi.id, versionNo: 1, formulaExpr: 'SUM(semantic)', status: KpiFormulaVersionStatus.ACTIVE, effectiveFrom: new Date() }));
      if (spec.threshold) {
        await thRepo.save(
          thRepo.create({
            kpiDefinitionId: kpi.id,
            scopeJson: {},
            warnLevel: spec.threshold.warn !== undefined ? String(spec.threshold.warn) : null,
            criticalLevel: spec.threshold.critical !== undefined ? String(spec.threshold.critical) : null,
            direction: spec.threshold.direction,
          }),
        );
      }
      console.log(`  + KPI ${spec.kpiCode} (${spec.semantic})`);
    }
  }

  // 2) alert_rule cấu hình — cảnh báo GAP vượt ngưỡng (CRITICAL) + HC-AVAILABLE thấp (WARN)
  const gapKpi = await kpiRepo.findOne({ where: { kpiCode: 'KPI-GAP' } });
  if (gapKpi && !(await ruleRepo.findOne({ where: { ruleCode: 'RULE-GAP-CRIT' } }))) {
    await ruleRepo.save(
      ruleRepo.create({ ruleCode: 'RULE-GAP-CRIT', name: 'GAP vượt ngưỡng', kpiDefinitionId: gapKpi.id, scopeJson: {}, warnLevel: '5', criticalLevel: '8', direction: ThresholdDirection.HIGHER_WORSE, slaHours: 48, status: KpiDefinitionStatus.ACTIVE }),
    );
    console.log('  + alert_rule RULE-GAP-CRIT');
  }
  const avKpi = await kpiRepo.findOne({ where: { kpiCode: 'KPI-HC-AVAILABLE' } });
  if (avKpi && !(await ruleRepo.findOne({ where: { ruleCode: 'RULE-AVAIL-LOW' } }))) {
    await ruleRepo.save(
      ruleRepo.create({ ruleCode: 'RULE-AVAIL-LOW', name: 'Khả dụng thấp', kpiDefinitionId: avKpi.id, scopeJson: {}, warnLevel: '200', criticalLevel: '100', direction: ThresholdDirection.LOWER_WORSE, slaHours: 72, status: KpiDefinitionStatus.ACTIVE }),
    );
    console.log('  + alert_rule RULE-AVAIL-LOW');
  }

  // 3) Nguồn demo DT-04 materiel snapshot (HC = 120 + 60 = 180)
  const matSnapRepo = dataSource.getRepository(MaterielSnapshot);
  const matLineRepo = dataSource.getRepository(MaterielSnapshotLine);
  let matSnap = await matSnapRepo.findOne({ where: { snapshotCode: DT12_MATERIEL_SNAPSHOT_CODE } });
  if (!matSnap) {
    matSnap = await matSnapRepo.save(
      matSnapRepo.create({ snapshotCode: DT12_MATERIEL_SNAPSHOT_CODE, asOfTime: new Date(), scope: {}, checksum: 'dt12-demo-mat-1', locked: true, lockedAt: new Date() }),
    );
    await matLineRepo.save(matLineRepo.create({ snapshotId: matSnap.id, materialCatalogId: DT12_DEMO_MAT1, organizationId: DT12_DEMO_ORG_ID, quantityOnHand: '120', grade1: '80', grade2: '30', grade3: '10', grade4: '0', grade5: '0', value: '12000' }));
    await matLineRepo.save(matLineRepo.create({ snapshotId: matSnap.id, materialCatalogId: DT12_DEMO_MAT2, organizationId: DT12_DEMO_ORG_ID, quantityOnHand: '60', grade1: '60', grade2: '0', grade3: '0', grade4: '0', grade5: '0', value: '6000' }));
    console.log('  + materiel_snapshot demo (HC=180)');
  }

  // 4) Nguồn demo DT-06 hold (EXCLUSIVE ACTIVE: SSCĐ 20 + REGULAR 10 → HC-AVAILABLE = 150; RESERVE-SSCĐ = 20)
  const holdRepo = dataSource.getRepository(AllocationHold);
  if (!(await holdRepo.findOne({ where: { allocationId: DT12_DEMO_ALLOC_ID } }))) {
    await holdRepo.save(
      holdRepo.create({ allocationId: DT12_DEMO_ALLOC_ID, category: AllocationCategory.SSCD, materialCatalogId: DT12_DEMO_MAT1, organizationId: DT12_DEMO_ORG_ID, quantityReserved: '20', semantics: AllocationSemantics.EXCLUSIVE, priority: 100, status: HoldStatus.ACTIVE }),
    );
    await holdRepo.save(
      holdRepo.create({ allocationId: DT12_DEMO_ALLOC_ID, category: AllocationCategory.REGULAR, materialCatalogId: DT12_DEMO_MAT2, organizationId: DT12_DEMO_ORG_ID, quantityReserved: '10', semantics: AllocationSemantics.EXCLUSIVE, priority: 100, status: HoldStatus.ACTIVE }),
    );
    console.log('  + allocation_hold demo (SSCĐ 20 + REGULAR 10)');
  }

  // 5) Nguồn demo DT-08 calculation_run (PC_SSCĐ = 30, NC = 30)
  const runRepo = dataSource.getRepository(CalculationRun);
  const calcRepo = dataSource.getRepository(MaterialCalculation);
  let run = await runRepo.findOne({ where: { scenarioId: DT12_DEMO_SCENARIO_ID } });
  if (!run) {
    run = await runRepo.save(
      runRepo.create({ scenarioId: DT12_DEMO_SCENARIO_ID, runNo: 1, inputHash: 'dt12-demo-input', outputHash: 'dt12-demo-output-1', status: CalculationRunStatus.COMPLETED, lineCount: 2, exceptionCount: 0, startedAt: new Date(), finishedAt: new Date() }),
    );
    await calcRepo.save(calcRepo.create({ runId: run.id, materialCatalogId: DT12_DEMO_MAT1, tt: '100', pcSscd: '20', hc: '120', nc: '0', supplyRequired: '0', ruleStatus: 'SELECTED', hcStatus: 'OK' }));
    await calcRepo.save(calcRepo.create({ runId: run.id, materialCatalogId: DT12_DEMO_MAT2, tt: '80', pcSscd: '10', hc: '60', nc: '30', supplyRequired: '30', ruleStatus: 'SELECTED', hcStatus: 'OK' }));
    console.log('  + calculation_run demo (PC_SSCĐ=30, NC=30)');
  }

  // 6) Nguồn demo DT-09 balance snapshot (SUPPLY_REQUIRED = 30, GAP = 10)
  const balSnapRepo = dataSource.getRepository(BalanceSnapshot);
  const balLineRepo = dataSource.getRepository(BalanceSnapshotLine);
  let balSnap = await balSnapRepo.findOne({ where: { planId: DT12_DEMO_PLAN_ID } });
  if (!balSnap) {
    balSnap = await balSnapRepo.save(
      balSnapRepo.create({ planId: DT12_DEMO_PLAN_ID, planRevisionNo: 1, approvedAt: new Date(), checksum: 'dt12-demo-balance-1', sourceFingerprint: 'dt12-demo-fp-1', locked: true }),
    );
    await balLineRepo.save(balLineRepo.create({ snapshotId: balSnap.id, materialCatalogId: DT12_DEMO_MAT1, supplyRequired: '0', plannedSourceQty: '0', gapQty: '0', reservationsJson: [] }));
    await balLineRepo.save(balLineRepo.create({ snapshotId: balSnap.id, materialCatalogId: DT12_DEMO_MAT2, supplyRequired: '30', plannedSourceQty: '20', gapQty: '10', reservationsJson: [] }));
    console.log('  + balance_snapshot demo (SUPPLY_REQUIRED=30, GAP=10)');
  }

  console.log(`DT-12 seed xong: ${KPIS.length} KPI (semantic) + 2 alert_rule + nguồn demo (HC=180, HC-AVAILABLE=150, RESERVE-SSCĐ=20, PC_SSCĐ=30, NC=30, SUPPLY=30, GAP=10).`);
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
