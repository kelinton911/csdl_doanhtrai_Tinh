// [08] DT-08 — Tính nhu cầu (Quyển VIII). Mỗi xã: 1 kịch bản + 1 lần chạy engine dt08-need-v1
// đọc HC THẬT từ materiel_snapshot DT-04 (hc_snapshot_ref) + định mức DT-07 (CONSUMPTION_PREPARATION)
// + PC_SSCĐ DT-06 (hold SSCĐ). NC = TT + PC_SSCĐ − HC (âm giữ dấu); NO_RULE/NO_HC không quy 0.
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CalculationScenario } from '../../../modules/dt08-calculation/entities/calculation-scenario.entity';
import { CalculationRun } from '../../../modules/dt08-calculation/entities/calculation-run.entity';
import { MaterialCalculation } from '../../../modules/dt08-calculation/entities/material-calculation.entity';
import { HcSnapshotRef } from '../../../modules/dt08-calculation/entities/hc-snapshot-ref.entity';
import { MaterialNorm } from '../../../modules/dt07-norms/entities/material-norm.entity';
import { SemanticParam, NormSourceStatus } from '../../../modules/dt07-norms/norms-rules';
import {
  computeMaterialNeed,
  computeInputHash,
  computeOutputHash,
  ENGINE_VERSION,
  CalculationRunStatus,
  CalcOutputLineForHash,
} from '../../../modules/dt08-calculation/calc-rules';
import { CalculationScenarioStatus } from '../../../common/enums';
import { standalone } from './_shared/run-step';
import { pickRepresentativeCommunes, MATERIALS, CORE_MATERIAL_CODES, CHAIN, T_SNAPSHOT } from './_shared/demo-ids';

const CORE = MATERIALS.filter((m) => CORE_MATERIAL_CODES.includes(m.code));

export async function run(ds: DataSource): Promise<void> {
  const scenarioRepo = ds.getRepository(CalculationScenario);
  const runRepo = ds.getRepository(CalculationRun);
  const calcRepo = ds.getRepository(MaterialCalculation);
  const hcRefRepo = ds.getRepository(HcSnapshotRef);
  const normRepo = ds.getRepository(MaterialNorm);

  const communes = await pickRepresentativeCommunes(ds, 4);
  let nScenario = 0;

  for (const c of communes) {
    const scenarioCode = CHAIN.scenarioCode(c.orgCode);
    if (await scenarioRepo.findOne({ where: { scenarioCode } })) continue;

    // Snapshot HC DT-04 của xã.
    const snapRow = await ds.query(`SELECT id FROM materiel_snapshot WHERE snapshot_code = $1 LIMIT 1`, [CHAIN.materielSnapshotCode(c.orgCode)]);
    const hcSnapshotId: string | null = snapRow?.[0]?.id ?? null;
    const hcByMat = new Map<string, number>();
    if (hcSnapshotId) {
      const lines: Array<{ material_catalog_id: string; quantity_on_hand: string }> = await ds.query(
        `SELECT material_catalog_id, quantity_on_hand FROM materiel_snapshot_line WHERE snapshot_id = $1`,
        [hcSnapshotId],
      );
      for (const l of lines) hcByMat.set(l.material_catalog_id, Number(l.quantity_on_hand));
    }

    const scope = { organizationId: c.orgId, materials: CORE.map((m) => ({ materialCatalogId: m.id, scale: 1, daysPrep: 1 })) };
    const scenario = await scenarioRepo.save(
      scenarioRepo.create({
        scenarioCode,
        name: `Tính nhu cầu bảo đảm ${c.orgCode} 2026`,
        scopeJson: scope,
        effectiveTime: T_SNAPSHOT,
        engineVersion: ENGINE_VERSION,
        status: CalculationScenarioStatus.DRAFT,
        hcSnapshotId,
      }),
    );

    const inputHash = computeInputHash({ scenarioCode, scope, effectiveTime: T_SNAPSHOT.toISOString(), engineVersion: ENGINE_VERSION, hcSnapshotId });
    const run = await runRepo.save(
      runRepo.create({ scenarioId: scenario.id, runNo: 1, inputHash, engineVersion: ENGINE_VERSION, status: CalculationRunStatus.RUNNING, startedAt: new Date() }),
    );
    await hcRefRepo.save(hcRefRepo.create({ runId: run.id, dt04SnapshotId: hcSnapshotId, asOfTime: T_SNAPSHOT, scope: { organizationId: c.orgId }, locked: true }));

    let exceptions = 0;
    const outLines: CalcOutputLineForHash[] = [];
    for (const mat of CORE) {
      // Định mức GĐCB (DT-07) — VERIFIED, đã publish (DT-07 seed).
      const norm = await normRepo.findOne({
        where: { materialCatalogId: mat.id, semanticParam: SemanticParam.CONSUMPTION_PREPARATION, sourceStatus: NormSourceStatus.VERIFIED },
      });
      const hc = hcByMat.has(mat.id) ? hcByMat.get(mat.id)! : null;
      // PC_SSCĐ = Σ hold ACTIVE category SSCD (DT-06).
      const pcRow = await ds.query(
        `SELECT COALESCE(SUM(quantity_reserved),0) AS pc FROM allocation_hold
          WHERE organization_id = $1 AND material_catalog_id = $2 AND category = 'SSCD' AND status = 'ACTIVE'`,
        [c.orgId, mat.id],
      );
      const pcSscd = Number(pcRow?.[0]?.pc ?? 0);

      const ruleStatus: 'SELECTED' | 'NO_RULE' = norm ? 'SELECTED' : 'NO_RULE';
      const hcStatus: 'OK' | 'NO_HC_SNAPSHOT' = hc === null ? 'NO_HC_SNAPSHOT' : 'OK';

      if (ruleStatus === 'SELECTED' && hcStatus === 'OK') {
        const res = computeMaterialNeed({ prep: { unitValue: Number(norm!.valueNumeric), scale: 1, days: 1 }, combat: null, pcSscd, hc: hc! });
        await calcRepo.save(
          calcRepo.create({
            runId: run.id, materialCatalogId: mat.id, phase: 'PREPARATION',
            ttGdcb: String(res.ttGdcb), ttGdcd: String(res.ttGdcd), tt: String(res.tt),
            pcSscd: String(res.pcSscd), hc: String(res.hc), nc: String(res.nc), supplyRequired: String(res.supplyRequired),
            ruleStatus, hcStatus,
          }),
        );
        outLines.push({ materialCatalogId: mat.id, ruleStatus, hcStatus, ttGdcb: res.ttGdcb, ttGdcd: res.ttGdcd, tt: res.tt, pcSscd: res.pcSscd, hc: res.hc, nc: res.nc, supplyRequired: res.supplyRequired });
      } else {
        exceptions++;
        await calcRepo.save(
          calcRepo.create({
            runId: run.id, materialCatalogId: mat.id, phase: 'PREPARATION',
            ttGdcb: null, ttGdcd: null, tt: null, pcSscd: null, hc: hc === null ? null : String(hc), nc: null, supplyRequired: null,
            ruleStatus, hcStatus,
          }),
        );
        outLines.push({ materialCatalogId: mat.id, ruleStatus, hcStatus, ttGdcb: null, ttGdcd: null, tt: null, pcSscd: null, hc, nc: null, supplyRequired: null });
      }
    }

    run.outputHash = computeOutputHash(outLines, ENGINE_VERSION);
    run.status = CalculationRunStatus.COMPLETED;
    run.lineCount = outLines.length;
    run.exceptionCount = exceptions;
    run.finishedAt = new Date();
    await runRepo.save(run);

    scenario.status = CalculationScenarioStatus.CALCULATED;
    await scenarioRepo.save(scenario);
    nScenario++;
  }

  console.log(`  [08] DT-08: kịch bản+run engine ${ENGINE_VERSION} +${nScenario} (NC từ HC thật + định mức + PC_SSCĐ).`);
}

if (require.main === module) standalone(run);
