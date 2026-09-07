// Integration test DT-08 — chạy trên DB THẬT (engine + DT-04/06/07). KHÔNG lọt vào
// `npm test` (tên *.int-spec.ts). Chạy: `npm run test:int` (cần DB dev — .env, mặc định 5435).
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../../database/data-source';
import { OutboxEvent } from '../../common/outbox/outbox-event.entity';
import { OutboxService } from '../../common/outbox/outbox.service';
import { BusinessException } from '../../common/errors/business-error';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

// DT-08
import { CalcService } from './calc.service';
import { CalculationScenario } from './entities/calculation-scenario.entity';
import { CalculationRun } from './entities/calculation-run.entity';
import { MaterialCalculation } from './entities/material-calculation.entity';
import { RuleResolutionSnapshot } from './entities/rule-resolution-snapshot.entity';
import { HcSnapshotRef } from './entities/hc-snapshot-ref.entity';
import { CalculationTraceNode } from './entities/calculation-trace-node.entity';
import { ScenarioComparison } from './entities/scenario-comparison.entity';
import { CalcPhase, CalculationScenarioStatus } from './calc-rules';

// DT-04
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';

// DT-06
import { AllocationService } from '../dt06-allocation/allocation.service';
import { AllocationType } from '../dt06-allocation/entities/allocation-type.entity';
import { InventoryAllocation } from '../dt06-allocation/entities/inventory-allocation.entity';
import { AllocationLine } from '../dt06-allocation/entities/allocation-line.entity';
import { AllocationHold } from '../dt06-allocation/entities/allocation-hold.entity';
import { ReserveRequirementLink } from '../dt06-allocation/entities/reserve-requirement-link.entity';
import { AllocationSnapshot, AllocationSnapshotLine } from '../dt06-allocation/entities/allocation-snapshot.entity';
import { AllocationChangeRequest } from '../dt06-allocation/entities/allocation-change-request.entity';
import { SlowMovingRule, SlowMovingEvaluation } from '../dt06-allocation/entities/slow-moving.entity';
import { MaterielMovement } from '../dt04-materiel/entities/materiel-movement.entity';
import { AllocationCategory, AllocationSemantics, HoldStatus } from '../dt06-allocation/alloc-rules';

// DT-07
import { NormsService } from '../dt07-norms/norms.service';
import { NormativeDocument, NormativeDocumentVersion, NormSourceReference } from '../dt07-norms/entities/normative-document.entity';
import { NormSet, NormSetVersion } from '../dt07-norms/entities/norm-set.entity';
import { MaterialNorm, NormDimension } from '../dt07-norms/entities/material-norm.entity';
import { AuthorityRankVersion, CalculationParameter, NormConflictCase, NormSelectorConfig } from '../dt07-norms/entities/norm-selector.entity';
import { NormImportBatch } from '../dt07-norms/entities/norm-import.entity';
import { Command, CommandAssignment, CommandProgress, CommandRequirement, CommandVersion } from '../dt07-norms/entities/command.entity';
import { DimensionType } from '../dt07-norms/norms-rules';

const RUN = Date.now();
const user: AuthUser = { sub: null as unknown as string, username: 'it', roles: [], organizationId: null };
const ORG = '00000000-0000-0000-0000-0000000d8011';
const MAT_A = '00000000-0000-0000-0000-0000000d8a01'; // SELECTED (prep+combat)
const MAT_B = '00000000-0000-0000-0000-0000000d8b02'; // NO_RULE (không định mức)
const MAT_C = '00000000-0000-0000-0000-0000000d8c03'; // CONFLICT (2 norm ngang)
const MAT_D = '00000000-0000-0000-0000-0000000d8d04'; // HC dư → NC âm
const EFFECTIVE = '2026-06-01T00:00:00+07:00';

describe('DT-08 CalcService — integration (DB thật)', () => {
  let ds: DataSource;
  let svc: CalcService;
  let norms: NormsService;
  const scenarioIds: string[] = [];
  const runIds: string[] = [];
  let snapshotId = '';
  let docVersionId = '';
  let refId = '';

  beforeAll(async () => {
    ds = new DataSource(dataSourceOptions);
    await ds.initialize();
    const outbox = new OutboxService(ds.getRepository(OutboxEvent));

    norms = new NormsService(
      ds.getRepository(NormativeDocument),
      ds.getRepository(NormativeDocumentVersion),
      ds.getRepository(NormSourceReference),
      ds.getRepository(NormSet),
      ds.getRepository(NormSetVersion),
      ds.getRepository(MaterialNorm),
      ds.getRepository(NormDimension),
      ds.getRepository(CalculationParameter),
      ds.getRepository(NormSelectorConfig),
      ds.getRepository(AuthorityRankVersion),
      ds.getRepository(NormConflictCase),
      ds.getRepository(NormImportBatch),
      ds.getRepository(Command),
      ds.getRepository(CommandVersion),
      ds.getRepository(CommandRequirement),
      ds.getRepository(CommandAssignment),
      ds.getRepository(CommandProgress),
      ds,
      outbox,
    );

    const allocation = new AllocationService(
      ds.getRepository(AllocationType),
      ds.getRepository(InventoryAllocation),
      ds.getRepository(AllocationLine),
      ds.getRepository(AllocationHold),
      ds.getRepository(ReserveRequirementLink),
      ds.getRepository(AllocationSnapshot),
      ds.getRepository(AllocationSnapshotLine),
      ds.getRepository(AllocationChangeRequest),
      ds.getRepository(SlowMovingRule),
      ds.getRepository(SlowMovingEvaluation),
      ds.getRepository(MaterielMovement),
    );

    svc = new CalcService(
      ds.getRepository(CalculationScenario),
      ds.getRepository(CalculationRun),
      ds.getRepository(MaterialCalculation),
      ds.getRepository(RuleResolutionSnapshot),
      ds.getRepository(HcSnapshotRef),
      ds.getRepository(CalculationTraceNode),
      ds.getRepository(ScenarioComparison),
      ds.getRepository(MaterielSnapshot),
      ds.getRepository(MaterielSnapshotLine),
      norms,
      allocation,
      ds,
      outbox,
    );

    // ---- Định mức DT-07: bộ chính (có căn cứ) + bộ xung đột (không căn cứ) ----
    const doc = await norms.createDocument({ docNo: `IT8-DOC-${RUN}`, title: 'IT8', issuingAuthority: 'BQP' }, user);
    const dv = await norms.createDocumentVersion(doc.id, { versionLabel: 'v1', fileHash: `IT8-HASH-${RUN}` }, user);
    docVersionId = dv.id;
    const ref = await norms.addReference(docVersionId, { pageNo: 12, lineRef: '§II', quoteText: 'căn cứ IT8' }, user);
    refId = ref.id;

    // Bộ chính: MAT_A prep=2/combat=5, MAT_D combat=1.
    const setMain = await norms.createSet({ setCode: `IT8-SET-${RUN}-main`, name: 'IT8 main' }, user);
    const vMain = await norms.createSetVersion(setMain.id, { versionLabel: 'v1', documentVersionId: docVersionId, effectiveFrom: '2026-01-01' }, user);
    await norms.addNorm(vMain.id, { materialCatalogId: MAT_A, semanticParam: 'CONSUMPTION_PREPARATION', valueNumeric: 2, rawValue: '2', sourceReferenceId: refId, effectiveFrom: '2026-01-01' }, user);
    await norms.addNorm(vMain.id, { materialCatalogId: MAT_A, semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: 5, rawValue: '5', sourceReferenceId: refId, effectiveFrom: '2026-01-01' }, user);
    await norms.addNorm(vMain.id, { materialCatalogId: MAT_D, semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: 1, rawValue: '1', sourceReferenceId: refId, effectiveFrom: '2026-01-01' }, user);
    await norms.publishSetVersion(vMain.id, user);

    // Bộ xung đột: 2 norm MAT_C combat, cùng dim MISSION=ATTACK, KHÔNG có văn bản → CONFLICT.
    const setConf = await norms.createSet({ setCode: `IT8-SET-${RUN}-conf`, name: 'IT8 conflict' }, user);
    const vConf = await norms.createSetVersion(setConf.id, { versionLabel: 'v1', effectiveFrom: '2026-01-01' }, user);
    for (const val of [3, 4]) {
      const n = await norms.addNorm(vConf.id, { materialCatalogId: MAT_C, semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: val, sourceReferenceId: refId, effectiveFrom: '2026-01-01' }, user);
      await norms.addScopes(n.id, { dimensions: [{ dimensionType: DimensionType.MISSION, dimensionValue: 'ATTACK' }] }, user);
    }
    await norms.publishSetVersion(vConf.id, user);

    // ---- HC snapshot DT-04 (khóa, bất biến): MAT_A=10, MAT_D=1000 ----
    const snap = await ds.getRepository(MaterielSnapshot).save(
      ds.getRepository(MaterielSnapshot).create({
        snapshotCode: `IT8-SNAP-${RUN}`, asOfTime: new Date(EFFECTIVE), scope: {}, locked: true, lockedAt: new Date(),
      }),
    );
    snapshotId = snap.id;
    await ds.getRepository(MaterielSnapshotLine).save([
      ds.getRepository(MaterielSnapshotLine).create({ snapshotId, materialCatalogId: MAT_A, quantityOnHand: '10' }),
      ds.getRepository(MaterielSnapshotLine).create({ snapshotId, materialCatalogId: MAT_D, quantityOnHand: '1000' }),
    ]);

    // ---- PC_SSCĐ DT-06: hold SSCD ACTIVE cho MAT_A = 5 ----
    await ds.getRepository(AllocationHold).save(
      ds.getRepository(AllocationHold).create({
        allocationId: '00000000-0000-0000-0000-0000000d8f01',
        category: AllocationCategory.SSCD,
        materialCatalogId: MAT_A,
        organizationId: ORG,
        quantityReserved: '5',
        semantics: AllocationSemantics.OVERLAY,
        status: HoldStatus.ACTIVE,
      }),
    );
  }, 60000);

  afterAll(async () => {
    if (!ds?.isInitialized) return;
    if (runIds.length) {
      await ds.query('DELETE FROM calculation_trace_node WHERE run_id = ANY($1)', [runIds]);
      await ds.query('DELETE FROM rule_resolution_snapshot WHERE run_id = ANY($1)', [runIds]);
      await ds.query('DELETE FROM material_calculation WHERE run_id = ANY($1)', [runIds]);
      await ds.query('DELETE FROM hc_snapshot_ref WHERE run_id = ANY($1)', [runIds]);
      await ds.query('DELETE FROM scenario_comparison WHERE base_run_id = ANY($1) OR target_run_id = ANY($1)', [runIds]);
      await ds.query('DELETE FROM outbox_event WHERE aggregate_id = ANY($1)', [runIds]);
      await ds.query('DELETE FROM calculation_run WHERE id = ANY($1)', [runIds]);
    }
    if (scenarioIds.length) await ds.query('DELETE FROM calculation_scenario WHERE id = ANY($1) OR based_on_id = ANY($1)', [scenarioIds]);
    // DT-07/06/04 seed cleanup.
    await ds.query('DELETE FROM norm_dimension WHERE material_norm_id IN (SELECT id FROM material_norm WHERE material_catalog_id = ANY($1))', [[MAT_A, MAT_C, MAT_D]]);
    await ds.query('DELETE FROM material_norm WHERE material_catalog_id = ANY($1)', [[MAT_A, MAT_C, MAT_D]]);
    await ds.query("DELETE FROM norm_set_version WHERE norm_set_id IN (SELECT id FROM norm_set WHERE set_code LIKE $1)", [`IT8-SET-${RUN}-%`]);
    await ds.query('DELETE FROM norm_set WHERE set_code LIKE $1', [`IT8-SET-${RUN}-%`]);
    await ds.query('DELETE FROM norm_conflict_case WHERE material_catalog_id = $1', [MAT_C]);
    if (refId) await ds.query('DELETE FROM norm_source_reference WHERE id = $1', [refId]);
    if (docVersionId) await ds.query('DELETE FROM normative_document_version WHERE id = $1', [docVersionId]);
    await ds.query('DELETE FROM normative_document WHERE doc_no = $1', [`IT8-DOC-${RUN}`]);
    if (snapshotId) {
      await ds.query('DELETE FROM materiel_snapshot_line WHERE snapshot_id = $1', [snapshotId]);
      await ds.query('DELETE FROM materiel_snapshot WHERE id = $1', [snapshotId]);
    }
    await ds.query('DELETE FROM allocation_hold WHERE material_catalog_id = $1 AND organization_id = $2', [MAT_A, ORG]);
    await ds.destroy();
  }, 60000);

  // Kịch bản chính: 4 vật chất phủ SELECTED/NO_RULE/CONFLICT/NC-âm.
  async function makeMainScenario(code: string, hcSnapshotId: string | null = snapshotId) {
    const s = await svc.createScenario(
      {
        scenarioCode: code,
        name: 'IT8 main scenario',
        effectiveTime: EFFECTIVE,
        hcSnapshotId: hcSnapshotId ?? undefined,
        scope: {
          mission: 'ATTACK',
          materials: [
            { materialCatalogId: MAT_A, phases: [CalcPhase.PREPARATION, CalcPhase.COMBAT], scale: 10, daysPrep: 3, daysCombat: 2 },
            { materialCatalogId: MAT_B, phases: [CalcPhase.COMBAT] },
            { materialCatalogId: MAT_C, phases: [CalcPhase.COMBAT] },
            { materialCatalogId: MAT_D, phases: [CalcPhase.COMBAT], scale: 1, daysCombat: 1 },
          ],
        },
      },
      user,
    );
    scenarioIds.push(s.id);
    return s;
  }

  it('run → bảng NC đủ 4 dòng: SELECTED/NO_RULE/CONFLICT + NC âm (TC-DT08-004/006/008/020/024)', async () => {
    const s = await makeMainScenario(`IT8-CS-${RUN}-main`);
    const run = await svc.run(s.id, user);
    runIds.push(run.id);
    expect(run.status).toBe('COMPLETED');
    expect(run.outputHash).toBeTruthy();

    const rows = await svc.runMaterials(run.id);
    const byMat = new Map(rows.map((r) => [r.materialCatalogId, r]));

    // MAT_A SELECTED: TT_GĐCB=60, TT_GĐCĐ=100, TT=160, PC=5, HC=10, NC=155 (TC-DT08-020).
    const a = byMat.get(MAT_A)!;
    expect(a.ruleStatus).toBe('SELECTED');
    expect(a.hcStatus).toBe('OK');
    expect(Number(a.ttGdcb)).toBe(60);
    expect(Number(a.ttGdcd)).toBe(100);
    expect(Number(a.tt)).toBe(160);
    expect(Number(a.ttGdcb) + Number(a.ttGdcd)).toBe(Number(a.tt));
    expect(Number(a.pcSscd)).toBe(5);
    expect(Number(a.hc)).toBe(10);
    expect(Number(a.nc)).toBe(155);
    expect(Number(a.supplyRequired)).toBe(155);

    // MAT_B NO_RULE: numerics NULL, KHÔNG quy 0 (TC-DT08-006).
    const b = byMat.get(MAT_B)!;
    expect(b.ruleStatus).toBe('NO_RULE');
    expect(b.nc).toBeNull();
    expect(b.supplyRequired).toBeNull();

    // MAT_C CONFLICT: không tự chọn, numerics NULL (TC-DT08-008).
    const c = byMat.get(MAT_C)!;
    expect(c.ruleStatus).toBe('CONFLICT');
    expect(c.supplyRequired).toBeNull();

    // MAT_D NC ÂM giữ nguyên dấu; supply_required=0 (TC-DT08-004).
    const d = byMat.get(MAT_D)!;
    expect(d.ruleStatus).toBe('SELECTED');
    expect(Number(d.hc)).toBe(1000);
    expect(Number(d.nc)).toBe(-999);
    expect(Number(d.supplyRequired)).toBe(0);

    // Trace 1 dòng MAT_A tới định mức (source_reference) + HC snapshot + PC_SSCĐ (TC-DT08-024).
    const trace = await svc.materialTrace(run.id, a.id);
    const stepTypes = trace.trace.map((t) => t.stepType);
    expect(stepTypes).toEqual(expect.arrayContaining(['NORM', 'RESERVE', 'HC', 'FORMULA']));
    expect(trace.resolutions.some((r) => r.status === 'SELECTED' && r.sourceReference)).toBe(true);
    const hcNode = trace.trace.find((t) => t.stepType === 'HC');
    expect(hcNode?.inputRefs).toMatchObject({ snapshotId });

    // Ngoại lệ gồm MAT_B (NO_RULE) + MAT_C (CONFLICT).
    const exc = await svc.exceptions(run.id);
    const excMats = exc.map((e) => e.materialCatalogId);
    expect(excMats).toEqual(expect.arrayContaining([MAT_B, MAT_C]));
    expect(run.exceptionCount).toBe(2);

    // supply_required cho DT-09: chỉ dòng đã tính (MAT_A, MAT_D).
    const supply = await svc.supplyRequired(run.id);
    const supplyMats = supply.items.map((i) => i.materialCatalogId);
    expect(supplyMats).toEqual(expect.arrayContaining([MAT_A, MAT_D]));
    expect(supplyMats).not.toContain(MAT_B);
    expect(supply.pendingExceptions).toBe(2);
  });

  it('chạy lại cùng input → output_hash TRÙNG (tái lập — TC-DT08-016)', async () => {
    const s = await makeMainScenario(`IT8-CS-${RUN}-repro`);
    const run1 = await svc.run(s.id, user);
    const run2 = await svc.run(s.id, user);
    runIds.push(run1.id, run2.id);
    expect(run1.inputHash).toBe(run2.inputHash);
    expect(run1.outputHash).toBe(run2.outputHash);

    // So sánh 2 run giống nhau → không dòng nào đổi.
    const cmp = await svc.compare(run1.id, run2.id, user);
    expect(cmp.changed).toBe(0);
  });

  it('thiếu hc_snapshot → NO_HC_SNAPSHOT, KHÔNG đọc số dư sống (TC-DT08-021)', async () => {
    const s = await svc.createScenario(
      {
        scenarioCode: `IT8-CS-${RUN}-nohc`,
        name: 'IT8 no hc',
        effectiveTime: EFFECTIVE,
        scope: { mission: 'ATTACK', materials: [{ materialCatalogId: MAT_A, phases: [CalcPhase.COMBAT] }] },
      },
      user,
    );
    scenarioIds.push(s.id);
    const run = await svc.run(s.id, user);
    runIds.push(run.id);
    const [row] = await svc.runMaterials(run.id);
    expect(row.hcStatus).toBe('NO_HC_SNAPSHOT');
    expect(row.nc).toBeNull(); // không tính → không quy 0
    const exc = await svc.exceptions(run.id);
    expect(exc.some((e) => e.materialCatalogId === MAT_A && e.hcStatus === 'NO_HC_SNAPSHOT')).toBe(true);
  });

  it('LOCK bất biến: run trên kịch bản đã LOCKED → từ chối; revise = clone (TC-DT08-011)', async () => {
    const s = await makeMainScenario(`IT8-CS-${RUN}-lock`);
    const run = await svc.run(s.id, user);
    runIds.push(run.id);

    const locked = await svc.lockScenario(s.id, user);
    expect(locked.status).toBe(CalculationScenarioStatus.LOCKED);

    // Chạy lại kịch bản đã LOCKED → LOCKED_IMMUTABLE.
    await expect(svc.run(s.id, user)).rejects.toBeInstanceOf(BusinessException);

    // Revise = clone bản mới DRAFT (based_on_id + revision_no+1).
    const clone = await svc.reviseScenario(s.id, { name: 'IT8 revised' }, user);
    scenarioIds.push(clone.id);
    expect(clone.status).toBe(CalculationScenarioStatus.DRAFT);
    expect(clone.basedOnId).toBe(s.id);
    expect(clone.revisionNo).toBe(2);
  });
});
