// [12] DT-12 — Dashboard chỉ huy (Quyển XII). 7 KPI (mỗi semantic 1) + formula + threshold + alert_rule,
// và metric_instance TÍNH TỪ SNAPSHOT THẬT của DT-04/06/08/09/10 (rollup toàn tỉnh) — KHÔNG bịa số,
// mọi metric có lineage về nguồn thật (AC-15). Idempotent theo kpi_code/rule_code/(kpi+as_of).
import 'reflect-metadata';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { KpiDefinition, KpiFormulaVersion } from '../../../modules/dt12-dashboard/entities/kpi-definition.entity';
import { KpiThreshold } from '../../../modules/dt12-dashboard/entities/kpi-threshold.entity';
import { AlertRule } from '../../../modules/dt12-dashboard/entities/alert-rule.entity';
import { MetricInstance } from '../../../modules/dt12-dashboard/entities/metric-instance.entity';
import { KpiDefinitionStatus, KpiFormulaVersionStatus, Semantic, ThresholdDirection, FreshnessStatus, Dt12SourceType } from '../../../modules/dt12-dashboard/dt12.enums';
import { standalone } from './_shared/run-step';
import { T_CUTOFF, PROVINCE_AREA_CODE } from './_shared/demo-ids';

interface KpiSpec { kpiCode: string; name: string; semantic: Semantic; unit: string; threshold?: { warn?: number; critical?: number; direction: ThresholdDirection } }
const KPIS: KpiSpec[] = [
  { kpiCode: 'KPI-HC', name: 'Hiện có (HC)', semantic: Semantic.SEM_HC, unit: 'đơn vị', threshold: { warn: 100, critical: 50, direction: ThresholdDirection.LOWER_WORSE } },
  { kpiCode: 'KPI-HC-AVAILABLE', name: 'Khả dụng (HC-AVAILABLE)', semantic: Semantic.SEM_HC_AVAILABLE, unit: 'đơn vị', threshold: { warn: 200, critical: 100, direction: ThresholdDirection.LOWER_WORSE } },
  { kpiCode: 'KPI-RESERVE-SSCD', name: 'Dự trữ SSCĐ', semantic: Semantic.SEM_RESERVE_SSCD, unit: 'đơn vị' },
  { kpiCode: 'KPI-PC-SCD', name: 'Phân cấp SSCĐ (PC_SSCĐ)', semantic: Semantic.SEM_PC_SCD, unit: 'đơn vị' },
  { kpiCode: 'KPI-NC', name: 'Nhu cầu (NC)', semantic: Semantic.SEM_NC, unit: 'đơn vị', threshold: { warn: 20, critical: 50, direction: ThresholdDirection.HIGHER_WORSE } },
  { kpiCode: 'KPI-SUPPLY-REQUIRED', name: 'Cần bảo đảm', semantic: Semantic.SEM_SUPPLY_REQUIRED, unit: 'đơn vị' },
  { kpiCode: 'KPI-GAP', name: 'Thiếu hụt (GAP)', semantic: Semantic.SEM_GAP, unit: 'đơn vị', threshold: { warn: 5, critical: 8, direction: ThresholdDirection.HIGHER_WORSE } },
];

const num = (rows: unknown[], key = 'v'): number => Number((rows as Array<Record<string, unknown>>)?.[0]?.[key] ?? 0);

export async function run(ds: DataSource): Promise<void> {
  const kpiRepo = ds.getRepository(KpiDefinition);
  const fvRepo = ds.getRepository(KpiFormulaVersion);
  const thRepo = ds.getRepository(KpiThreshold);
  const ruleRepo = ds.getRepository(AlertRule);
  const metricRepo = ds.getRepository(MetricInstance);

  // 1) KPI + formula + threshold (cấu hình).
  const kpiIdByCode = new Map<string, string>();
  for (const spec of KPIS) {
    let kpi = await kpiRepo.findOne({ where: { kpiCode: spec.kpiCode } });
    if (!kpi) {
      kpi = await kpiRepo.save(kpiRepo.create({ kpiCode: spec.kpiCode, name: spec.name, semanticRef: spec.semantic, unit: spec.unit, status: KpiDefinitionStatus.ACTIVE, currentVersionNo: 1 }));
      await fvRepo.save(fvRepo.create({ kpiDefinitionId: kpi.id, versionNo: 1, formulaExpr: 'SUM(semantic)', status: KpiFormulaVersionStatus.ACTIVE, effectiveFrom: new Date() }));
      if (spec.threshold) {
        await thRepo.save(thRepo.create({ kpiDefinitionId: kpi.id, scopeJson: {}, warnLevel: spec.threshold.warn !== undefined ? String(spec.threshold.warn) : null, criticalLevel: spec.threshold.critical !== undefined ? String(spec.threshold.critical) : null, direction: spec.threshold.direction }));
      }
    }
    kpiIdByCode.set(spec.kpiCode, kpi.id);
  }

  // 2) alert_rule (cấu hình).
  const gapId = kpiIdByCode.get('KPI-GAP');
  if (gapId && !(await ruleRepo.findOne({ where: { ruleCode: 'RULE-GAP-CRIT' } }))) {
    await ruleRepo.save(ruleRepo.create({ ruleCode: 'RULE-GAP-CRIT', name: 'GAP vượt ngưỡng', kpiDefinitionId: gapId, scopeJson: {}, warnLevel: '5', criticalLevel: '8', direction: ThresholdDirection.HIGHER_WORSE, slaHours: 48, status: KpiDefinitionStatus.ACTIVE }));
  }
  const avId = kpiIdByCode.get('KPI-HC-AVAILABLE');
  if (avId && !(await ruleRepo.findOne({ where: { ruleCode: 'RULE-AVAIL-LOW' } }))) {
    await ruleRepo.save(ruleRepo.create({ ruleCode: 'RULE-AVAIL-LOW', name: 'Khả dụng thấp', kpiDefinitionId: avId, scopeJson: {}, warnLevel: '200', criticalLevel: '100', direction: ThresholdDirection.LOWER_WORSE, slaHours: 72, status: KpiDefinitionStatus.ACTIVE }));
  }

  // 3) Đọc SNAPSHOT THẬT của chuỗi (rollup toàn tỉnh) — không bịa số.
  const hc = num(await ds.query(`SELECT COALESCE(SUM(l.quantity_on_hand),0) v FROM materiel_snapshot_line l JOIN materiel_snapshot s ON s.id=l.snapshot_id WHERE s.snapshot_code LIKE 'SNAP-MAT-%'`));
  const holdExclusive = num(await ds.query(`SELECT COALESCE(SUM(h.quantity_reserved),0) v FROM allocation_hold h JOIN inventory_allocation a ON a.id=h.allocation_id WHERE a.allocation_no LIKE 'PB-%' AND h.status='ACTIVE' AND h.semantics='EXCLUSIVE'`));
  const reserveSscd = num(await ds.query(`SELECT COALESCE(SUM(h.quantity_reserved),0) v FROM allocation_hold h JOIN inventory_allocation a ON a.id=h.allocation_id WHERE a.allocation_no LIKE 'PB-%' AND h.status='ACTIVE' AND h.category='SSCD'`));
  const pcScd = num(await ds.query(`SELECT COALESCE(SUM(mc.pc_sscd),0) v FROM material_calculation mc JOIN calculation_run r ON r.id=mc.run_id JOIN calculation_scenario sc ON sc.id=r.scenario_id WHERE sc.scenario_code LIKE 'KB-%'`));
  const nc = num(await ds.query(`SELECT COALESCE(SUM(mc.nc),0) v FROM material_calculation mc JOIN calculation_run r ON r.id=mc.run_id JOIN calculation_scenario sc ON sc.id=r.scenario_id WHERE sc.scenario_code LIKE 'KB-%' AND mc.nc IS NOT NULL`));
  const supply = num(await ds.query(`SELECT COALESCE(SUM(bl.supply_required),0) v FROM balance_line bl JOIN balance_plan p ON p.id=bl.plan_id WHERE p.plan_code LIKE 'CD-%'`));
  const gap = num(await ds.query(`SELECT COALESCE(SUM(bl.gap_qty),0) v FROM balance_line bl JOIN balance_plan p ON p.id=bl.plan_id WHERE p.plan_code LIKE 'CD-%'`));

  const snapIds: Array<{ id: string }> = await ds.query(`SELECT id FROM materiel_snapshot WHERE snapshot_code LIKE 'SNAP-MAT-%'`);
  const valueBySemantic: Record<Semantic, { value: number; source: Dt12SourceType }> = {
    [Semantic.SEM_HC]: { value: hc, source: Dt12SourceType.DT04_MATERIEL_SNAPSHOT },
    [Semantic.SEM_HC_AVAILABLE]: { value: hc - holdExclusive, source: Dt12SourceType.DT06_ALLOCATION_HOLD },
    [Semantic.SEM_RESERVE_SSCD]: { value: reserveSscd, source: Dt12SourceType.DT06_ALLOCATION_HOLD },
    [Semantic.SEM_PC_SCD]: { value: pcScd, source: Dt12SourceType.DT08_CALCULATION_RUN },
    [Semantic.SEM_NC]: { value: nc, source: Dt12SourceType.DT08_CALCULATION_RUN },
    [Semantic.SEM_SUPPLY_REQUIRED]: { value: supply, source: Dt12SourceType.DT09_BALANCE_SNAPSHOT },
    [Semantic.SEM_GAP]: { value: gap, source: Dt12SourceType.DT09_BALANCE_SNAPSHOT },
  };

  // 4) metric_instance có lineage thật (idempotent theo kpi + as_of).
  let nMetric = 0;
  const sourceVersion = 'chain-1';
  for (const spec of KPIS) {
    const kpiId = kpiIdByCode.get(spec.kpiCode)!;
    if (await metricRepo.findOne({ where: { kpiDefinitionId: kpiId, asOfTime: T_CUTOFF, sourceVersion } })) continue;
    const { value, source } = valueBySemantic[spec.semantic];
    const lineage = [{ sourceType: source, snapshotIds: snapIds.map((s) => s.id).slice(0, 4), scope: { provinceCode: PROVINCE_AREA_CODE } }];
    const metricHash = createHash('sha256').update(JSON.stringify({ kpiCode: spec.kpiCode, value, sourceVersion })).digest('hex').slice(0, 32);
    await metricRepo.save(
      metricRepo.create({
        kpiDefinitionId: kpiId,
        scopeJson: { provinceCode: PROVINCE_AREA_CODE },
        asOfTime: T_CUTOFF,
        value: String(value),
        sourceAsOf: T_CUTOFF,
        sourceVersion,
        lineageJson: lineage,
        freshnessStatus: FreshnessStatus.FRESH,
        metricHash,
      }),
    );
    nMetric++;
  }

  console.log(
    `  [12] DT-12: ${KPIS.length} KPI + 2 alert_rule + metric_instance +${nMetric} ` +
      `(HC=${hc}, HC-AVAIL=${hc - holdExclusive}, RESERVE-SSCĐ=${reserveSscd}, PC=${pcScd}, NC=${nc}, SUPPLY=${supply}, GAP=${gap}).`,
  );
}

if (require.main === module) standalone(run);
