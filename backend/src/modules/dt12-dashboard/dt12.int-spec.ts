// Integration test DT-12 — chạy trên DB THẬT. Chuỗi Dashboard chỉ huy: dựng nguồn snapshot (DT-04 materiel +
// DT-06 hold + DT-09 balance) → định nghĩa KPI (semantic) → compute metric (lineage + freshness) → drill-down
// khớp tổng → so HC vs HC-AVAILABLE → command-overview có lineage → cảnh báo vượt ngưỡng → what-if cách ly →
// nguồn mới hơn ⇒ STALE. Dùng org/id ngẫu nhiên + asOfTime tương lai để tách khỏi dữ liệu dev có sẵn.
import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { OutboxEvent } from '../../common/outbox/outbox-event.entity';
import { OutboxService } from '../../common/outbox/outbox.service';
import { Dt12Service } from './dt12.service';
import { KpiDefinition, KpiFormulaVersion } from './entities/kpi-definition.entity';
import { KpiThreshold } from './entities/kpi-threshold.entity';
import { MetricInstance } from './entities/metric-instance.entity';
import { DataMartRefresh } from './entities/data-mart-refresh.entity';
import { DimMaterial, DimOrg, DimTime, DimQuality, FactBalance, FactCount, FactInventory, FactRequirement } from './entities/data-mart.entity';
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
import { AllocationCategory, AllocationSemantics, HoldStatus } from '../dt06-allocation/alloc-rules';
import { CalculationRunStatus } from '../dt08-calculation/calc-rules';
import { AlertInstanceStatus, AlertSeverity, FactType, FreshnessStatus, Semantic, ThresholdDirection } from './dt12.enums';

const user: AuthUser = { sub: null as unknown as string, username: 'it-dt12', roles: [], organizationId: null };

describe('DT-12 Dt12Service — integration (DB thật)', () => {
  let ds: DataSource;
  let svc: Dt12Service;

  const suffix = randomUUID().slice(0, 8);
  const ORG = randomUUID();
  const MAT1 = randomUUID();
  const MAT2 = randomUUID();
  const MAT_CODE = `IT-DT12-MAT-${suffix}`;
  const MAT_CODE_V2 = `IT-DT12-MAT2-${suffix}`;
  const PLAN_ID = randomUUID();
  const ALLOC_ID = randomUUID();
  const KPI_HC = `IT-KPI-HC-${suffix}`;
  const KPI_AV = `IT-KPI-AV-${suffix}`;
  const KPI_GAP = `IT-KPI-GAP-${suffix}`;
  const RULE_GAP = `IT-RULE-GAP-${suffix}`;
  const FUTURE = new Date('2099-01-01T00:00:00.000Z');
  const FUTURE2 = new Date('2100-01-01T00:00:00.000Z');

  const scope = { organizationId: ORG };

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();
    svc = new Dt12Service(
      ds.getRepository(KpiDefinition),
      ds.getRepository(KpiFormulaVersion),
      ds.getRepository(KpiThreshold),
      ds.getRepository(MetricInstance),
      ds.getRepository(DataMartRefresh),
      ds.getRepository(DimMaterial),
      ds.getRepository(DimOrg),
      ds.getRepository(DimTime),
      ds.getRepository(DimQuality),
      ds.getRepository(FactInventory),
      ds.getRepository(FactRequirement),
      ds.getRepository(FactBalance),
      ds.getRepository(FactCount),
      ds.getRepository(AlertRule),
      ds.getRepository(AlertInstance),
      ds.getRepository(AlertAssignment),
      ds.getRepository(DecisionSession),
      ds.getRepository(DecisionOption),
      ds.getRepository(DecisionCriterion),
      ds.getRepository(DecisionScore),
      ds.getRepository(DecisionRecord),
      ds.getRepository(MaterielSnapshot),
      ds.getRepository(MaterielSnapshotLine),
      ds.getRepository(AllocationHold),
      ds.getRepository(AllocationSnapshot),
      ds.getRepository(AllocationSnapshotLine),
      ds.getRepository(CalculationRun),
      ds.getRepository(MaterialCalculation),
      ds.getRepository(BalanceSnapshot),
      ds.getRepository(BalanceSnapshotLine),
      ds.getRepository(OfficialSnapshot),
      ds.getRepository(OfficialSnapshotLine),
      new OutboxService(ds.getRepository(OutboxEvent)),
      ds,
    );

    // Nguồn DT-04: materiel snapshot (asOfTime tương lai ⇒ là bản mới nhất) — HC(org) = 100 + 40 = 140.
    const matRepo = ds.getRepository(MaterielSnapshot);
    const matLineRepo = ds.getRepository(MaterielSnapshotLine);
    const snap = await matRepo.save(matRepo.create({ snapshotCode: MAT_CODE, asOfTime: FUTURE, scope: {}, checksum: `chk-${suffix}-v1`, locked: true }));
    await matLineRepo.save(matLineRepo.create({ snapshotId: snap.id, materialCatalogId: MAT1, organizationId: ORG, quantityOnHand: '100', grade1: '100', grade2: '0', grade3: '0', grade4: '0', grade5: '0', value: '10000' }));
    await matLineRepo.save(matLineRepo.create({ snapshotId: snap.id, materialCatalogId: MAT2, organizationId: ORG, quantityOnHand: '40', grade1: '40', grade2: '0', grade3: '0', grade4: '0', grade5: '0', value: '4000' }));

    // Nguồn DT-06: hold EXCLUSIVE ACTIVE (SSCĐ 15 + REGULAR 5) ⇒ HC-AVAILABLE = 140 − 20 = 120; RESERVE-SSCĐ = 15.
    const holdRepo = ds.getRepository(AllocationHold);
    await holdRepo.save(holdRepo.create({ allocationId: ALLOC_ID, category: AllocationCategory.SSCD, materialCatalogId: MAT1, organizationId: ORG, quantityReserved: '15', semantics: AllocationSemantics.EXCLUSIVE, priority: 100, status: HoldStatus.ACTIVE }));
    await holdRepo.save(holdRepo.create({ allocationId: ALLOC_ID, category: AllocationCategory.REGULAR, materialCatalogId: MAT2, organizationId: ORG, quantityReserved: '5', semantics: AllocationSemantics.EXCLUSIVE, priority: 100, status: HoldStatus.ACTIVE }));

    // Nguồn DT-09: balance snapshot (approvedAt tương lai ⇒ mới nhất) — GAP = 0 + 10 = 10; SUPPLY = 30.
    const balRepo = ds.getRepository(BalanceSnapshot);
    const balLineRepo = ds.getRepository(BalanceSnapshotLine);
    const bal = await balRepo.save(balRepo.create({ planId: PLAN_ID, planRevisionNo: 1, approvedAt: FUTURE, checksum: `bal-${suffix}-v1`, sourceFingerprint: `fp-${suffix}`, locked: true }));
    await balLineRepo.save(balLineRepo.create({ snapshotId: bal.id, materialCatalogId: MAT1, supplyRequired: '0', plannedSourceQty: '0', gapQty: '0', reservationsJson: [] }));
    await balLineRepo.save(balLineRepo.create({ snapshotId: bal.id, materialCatalogId: MAT2, supplyRequired: '30', plannedSourceQty: '20', gapQty: '10', reservationsJson: [] }));

    // KPI (semantic) cấu hình.
    await svc.createKpi({ kpiCode: KPI_HC, name: 'HC', semanticRef: Semantic.SEM_HC, unit: 'đv' }, user);
    await svc.createKpi({ kpiCode: KPI_AV, name: 'HC khả dụng', semanticRef: Semantic.SEM_HC_AVAILABLE, unit: 'đv' }, user);
    await svc.createKpi({ kpiCode: KPI_GAP, name: 'GAP', semanticRef: Semantic.SEM_GAP, unit: 'đv' }, user);
  });

  afterAll(async () => {
    if (!ds?.isInitialized) return;
    // Dọn dữ liệu test (đặc biệt snapshot asOfTime tương lai) để không ảnh hưởng phân hệ khác / E2E.
    await ds.query('DELETE FROM metric_instance WHERE kpi_definition_id IN (SELECT id FROM kpi_definition WHERE kpi_code = ANY($1))', [[KPI_HC, KPI_AV, KPI_GAP]]).catch(() => undefined);
    await ds.query('DELETE FROM alert_instance WHERE rule_id IN (SELECT id FROM alert_rule WHERE rule_code = $1)', [RULE_GAP]).catch(() => undefined);
    await ds.query('DELETE FROM alert_rule WHERE rule_code = $1', [RULE_GAP]).catch(() => undefined);
    await ds.query('DELETE FROM decision_session WHERE title LIKE $1', [`IT-DT12-${suffix}%`]).catch(() => undefined);
    await ds.query('DELETE FROM kpi_definition WHERE kpi_code = ANY($1)', [[KPI_HC, KPI_AV, KPI_GAP]]).catch(() => undefined);
    await ds.query('DELETE FROM materiel_snapshot_line WHERE snapshot_id IN (SELECT id FROM materiel_snapshot WHERE snapshot_code = ANY($1))', [[MAT_CODE, MAT_CODE_V2]]).catch(() => undefined);
    await ds.query('DELETE FROM materiel_snapshot WHERE snapshot_code = ANY($1)', [[MAT_CODE, MAT_CODE_V2]]).catch(() => undefined);
    await ds.query('DELETE FROM allocation_hold WHERE allocation_id = $1', [ALLOC_ID]).catch(() => undefined);
    await ds.query('DELETE FROM balance_snapshot_line WHERE snapshot_id IN (SELECT id FROM balance_snapshot WHERE plan_id = $1)', [PLAN_ID]).catch(() => undefined);
    await ds.query('DELETE FROM balance_snapshot WHERE plan_id = $1', [PLAN_ID]).catch(() => undefined);
    await ds.destroy();
  });

  let hcMetricId: string;

  it('compute metric HC + drill-down khớp tổng snapshot DT-04 (TC-DT12-001)', async () => {
    const m = await svc.computeMetric({ kpiCode: KPI_HC, scopeJson: scope }, user);
    hcMetricId = m.id;
    expect(Number(m.value)).toBe(140);
    expect(m.metricHash).toHaveLength(64);
    expect(m.freshnessStatus).toBe(FreshnessStatus.FRESH);
    expect(Array.isArray(m.lineageJson)).toBe(true);
    expect((m.lineageJson as unknown[]).length).toBeGreaterThan(0); // có lineage — AC-15

    const dd = await svc.getMetricDrillDown(m.id);
    expect(dd.sourceType).toBe('DT04_MATERIEL_SNAPSHOT');
    expect(dd.drillDownTotal).toBe(140); // tổng dòng snapshot = value metric
    expect(dd.rows.length).toBe(2);
  });

  it('SEM-HC ≠ SEM-HC-AVAILABLE, chênh đúng phần hold (TC-DT12-003)', async () => {
    const res = await svc.semantics(user, scope);
    const hc = res.items.find((i) => i.semantic === Semantic.SEM_HC)!;
    const av = res.items.find((i) => i.semantic === Semantic.SEM_HC_AVAILABLE)!;
    expect(hc.value).toBe(140);
    expect(av.value).toBe(120); // 140 − (15 + 5) hold EXCLUSIVE
    expect(hc.value! - av.value!).toBe(20);
    const reserve = res.items.find((i) => i.semantic === Semantic.SEM_RESERVE_SSCD)!;
    expect(reserve.value).toBe(15);
  });

  it('command-overview: mọi KPI có lineage, không có số Dashboard độc lập (TC-DT12-015)', async () => {
    const ov = await svc.commandOverview(user, scope);
    const mine = ov.kpis.filter((k) => [KPI_HC, KPI_AV, KPI_GAP].includes(k.kpiCode));
    expect(mine.length).toBe(3);
    for (const k of mine) {
      expect(Array.isArray(k.lineage)).toBe(true);
      expect((k.lineage as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it('cảnh báo GAP vượt ngưỡng → CRITICAL + SLA due_at (TC-DT12-012)', async () => {
    await svc.createAlertRule({ ruleCode: RULE_GAP, name: 'GAP crit', kpiCode: KPI_GAP, warnLevel: 5, criticalLevel: 8, direction: ThresholdDirection.HIGHER_WORSE, slaHours: 48 }, user);
    const res = await svc.evaluateAlerts({ ruleCode: RULE_GAP }, user);
    expect(res.created).toBe(1);
    const a = res.alerts[0];
    expect(a.severity).toBe(AlertSeverity.CRITICAL); // GAP=10 ≥ critical 8
    expect(a.status).toBe(AlertInstanceStatus.OPEN);
    expect(a.dueAt).toBeTruthy();

    // Lifecycle: OPEN → ACK → RESOLVED.
    const acked = await svc.ackAlert(a.id, {}, user);
    expect(acked.status).toBe(AlertInstanceStatus.ACK);
    const resolved = await svc.resolveAlert(a.id, { resolution: 'đã bổ sung nguồn' }, user);
    expect(resolved.status).toBe(AlertInstanceStatus.RESOLVED);

    // Gom trùng: quét lại KHÔNG tạo trùng (alert cũ đã RESOLVED ⇒ dedupe mới OPEN được phép, nhưng cùng dedupe đang mở thì không).
    const again = await svc.evaluateAlerts({ ruleCode: RULE_GAP }, user);
    expect(again.created).toBe(1); // bản cũ đã RESOLVED nên tạo bản mới; nếu để OPEN thì sẽ 0
  });

  it('what-if cách ly: chấm điểm KHÔNG thay đổi metric/nguồn vận hành (TC-DT12-008)', async () => {
    const metricsBefore = await ds.getRepository(MetricInstance).count();
    const hcLinesBefore = await ds.query('SELECT COALESCE(SUM(quantity_on_hand),0) s FROM materiel_snapshot_line l JOIN materiel_snapshot s ON s.id=l.snapshot_id WHERE s.snapshot_code=$1', [MAT_CODE]);

    const session = await svc.createSession({ title: `IT-DT12-${suffix} what-if`, scopeJson: scope, paramsJson: { addSource: 10 } }, user);
    await svc.addOption(session.id, { optionKey: 'A', label: 'Bổ sung nội bộ' }, user);
    await svc.addOption(session.id, { optionKey: 'B', label: 'Điều chuyển' }, user);
    await svc.addCriterion(session.id, { criterionKey: 'gapReduce', label: 'Giảm GAP', weight: 2, direction: 'HIGHER_BETTER' }, user);
    const scored = await svc.score(session.id, { scores: [
      { optionKey: 'A', criterionKey: 'gapReduce', rawValue: 8 },
      { optionKey: 'B', criterionKey: 'gapReduce', rawValue: 4 },
    ] }, user);
    expect(scored.ranking[0].optionKey).toBe('A');

    const metricsAfter = await ds.getRepository(MetricInstance).count();
    const hcLinesAfter = await ds.query('SELECT COALESCE(SUM(quantity_on_hand),0) s FROM materiel_snapshot_line l JOIN materiel_snapshot s ON s.id=l.snapshot_id WHERE s.snapshot_code=$1', [MAT_CODE]);
    expect(metricsAfter).toBe(metricsBefore); // what-if không sinh metric vận hành
    expect(Number(hcLinesAfter[0].s)).toBe(Number(hcLinesBefore[0].s)); // nguồn HC không đổi

    const rec = await svc.recordDecision(session.id, { chosenOptionKey: 'A', rationale: 'điểm cao nhất' }, user);
    expect(rec.chosenOptionId).toBeTruthy();
  });

  it('nguồn có phiên bản mới hơn ⇒ metric cũ hiển thị STALE (TC-DT12-006)', async () => {
    // Trước khi thêm snapshot mới: metric HC còn FRESH.
    const before = await svc.getMetricLineage(hcMetricId);
    expect(before.freshness).toBe(FreshnessStatus.FRESH);

    // Thêm materiel snapshot MỚI HƠN (asOfTime FUTURE2) ⇒ latest đổi ⇒ metric cũ STALE.
    const matRepo = ds.getRepository(MaterielSnapshot);
    const matLineRepo = ds.getRepository(MaterielSnapshotLine);
    const snap2 = await matRepo.save(matRepo.create({ snapshotCode: MAT_CODE_V2, asOfTime: FUTURE2, scope: {}, checksum: `chk-${suffix}-v2`, locked: true }));
    await matLineRepo.save(matLineRepo.create({ snapshotId: snap2.id, materialCatalogId: MAT1, organizationId: ORG, quantityOnHand: '110', grade1: '110', grade2: '0', grade3: '0', grade4: '0', grade5: '0', value: '11000' }));

    const after = await svc.getMetricLineage(hcMetricId);
    expect(after.freshness).toBe(FreshnessStatus.STALE);
  });

  it('Data Mart refresh sinh fact + freshness FRESH (qua outbox)', async () => {
    const r = await svc.refreshDataMart({ factType: FactType.BALANCE }, user);
    expect(r.rowCount).toBeGreaterThanOrEqual(2);
    expect(r.outboxEventId).toBeTruthy();
    const fresh = await svc.dataMartFreshness();
    const bal = fresh.items.find((i) => i.factType === FactType.BALANCE)!;
    expect(bal.freshness).toBe(FreshnessStatus.FRESH);
  });
});
