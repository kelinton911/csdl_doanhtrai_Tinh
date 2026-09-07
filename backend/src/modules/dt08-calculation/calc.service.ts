import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { CalculationScenario } from './entities/calculation-scenario.entity';
import { CalculationRun } from './entities/calculation-run.entity';
import { MaterialCalculation } from './entities/material-calculation.entity';
import { RuleResolutionSnapshot } from './entities/rule-resolution-snapshot.entity';
import { HcSnapshotRef } from './entities/hc-snapshot-ref.entity';
import { CalculationTraceNode } from './entities/calculation-trace-node.entity';
import { ScenarioComparison } from './entities/scenario-comparison.entity';
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';
import { NormsService } from '../dt07-norms/norms.service';
import { AllocationService } from '../dt06-allocation/allocation.service';
import {
  CalcPhase,
  CalculationRunStatus,
  CalculationScenarioStatus,
  CompareLine,
  ENGINE_VERSION,
  HcStatus,
  MaterialRuleStatus,
  NeedResult,
  PHASE_SEMANTIC,
  PhaseContribution,
  SCENARIO_TRANSITIONS,
  assertScenarioEditable,
  compareRuns,
  computeInputHash,
  computeMaterialNeed,
  computeOutputHash,
  determineLineStatus,
} from './calc-rules';
import { assertTransition } from '../../common/enums/assert-transition';
import { resolveAsOf, toHcmIso } from '../../common/time/as-of';
import { PaginationQuery, paginated } from '../../common/dto/pagination.dto';
import { OutboxService } from '../../common/outbox/outbox.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateScenarioDto, ReviseScenarioDto, ScenarioMaterialDto, ScenarioScopeDto } from './dt08.dto';

// Kết quả resolve gom cho một giai đoạn (dùng nội bộ engine).
interface PhaseResolveInfo {
  phase: CalcPhase;
  semanticParam: string;
  status: MaterialRuleStatus;
  resolvedNormId: string | null;
  valueNumeric: number | null;
  valueType: string | null;
  sourceReference: string | null;
  trace: Record<string, unknown>;
}

// DT-08 — Engine tính nhu cầu NC = TT + PC_SSCĐ − HC (Quyển VIII §II/§VII/§VIII).
// Kết hợp định mức (DT-07 resolve) + HC as-of (DT-04 hc_snapshot) + dự trữ SSCĐ (DT-06).
@Injectable()
export class CalcService {
  constructor(
    @InjectRepository(CalculationScenario) private readonly scenarios: Repository<CalculationScenario>,
    @InjectRepository(CalculationRun) private readonly runs: Repository<CalculationRun>,
    @InjectRepository(MaterialCalculation) private readonly materialCalcs: Repository<MaterialCalculation>,
    @InjectRepository(RuleResolutionSnapshot) private readonly ruleSnaps: Repository<RuleResolutionSnapshot>,
    @InjectRepository(HcSnapshotRef) private readonly hcRefs: Repository<HcSnapshotRef>,
    @InjectRepository(CalculationTraceNode) private readonly traceNodes: Repository<CalculationTraceNode>,
    @InjectRepository(ScenarioComparison) private readonly comparisons: Repository<ScenarioComparison>,
    @InjectRepository(MaterielSnapshot) private readonly materielSnapshots: Repository<MaterielSnapshot>,
    @InjectRepository(MaterielSnapshotLine) private readonly materielSnapshotLines: Repository<MaterielSnapshotLine>,
    private readonly norms: NormsService,
    private readonly allocation: AllocationService,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  private uid(u: AuthUser) {
    return u?.sub ?? null;
  }

  // ======================= Kịch bản =======================
  listScenarios(q: PaginationQuery) {
    return this.scenarios
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'DESC')
      .skip(q.skip)
      .take(q.size)
      .getManyAndCount()
      .then(([data, total]) => paginated(data, total, q));
  }

  async getScenario(id: string): Promise<CalculationScenario> {
    const s = await this.scenarios.findOne({ where: { id } });
    if (!s) throw new NotFoundException(`DATA-001: Không có kịch bản ${id}`);
    return s;
  }

  async createScenario(dto: CreateScenarioDto, user: AuthUser): Promise<CalculationScenario> {
    const scenarioCode = dto.scenarioCode ?? `CS-${Date.now()}`;
    const dup = await this.scenarios.findOne({ where: { scenarioCode } });
    if (dup) throw new NotFoundException(`DATA-003: Kịch bản ${scenarioCode} đã tồn tại`);
    return this.scenarios.save(
      this.scenarios.create({
        scenarioCode,
        name: dto.name,
        missionId: dto.missionId ?? null,
        scopeJson: dto.scope as unknown as Record<string, unknown>,
        effectiveTime: resolveAsOf(dto.effectiveTime),
        engineVersion: ENGINE_VERSION,
        revisionNo: 1,
        status: CalculationScenarioStatus.DRAFT,
        basedOnId: null,
        hcSnapshotId: dto.hcSnapshotId ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // Revise = clone bản mới DRAFT (based_on_id + revision_no+1). LOCKED vẫn revise được
  // (đó là cách sửa khi nguồn đổi — BR-DT08-011/012). KHÔNG sửa trực tiếp bản cũ.
  async reviseScenario(id: string, dto: ReviseScenarioDto, user: AuthUser): Promise<CalculationScenario> {
    const base = await this.getScenario(id);
    const revisionNo = base.revisionNo + 1;
    const scenarioCode = dto.scenarioCode ?? `${base.scenarioCode}-r${revisionNo}`;
    return this.scenarios.save(
      this.scenarios.create({
        scenarioCode,
        name: dto.name ?? base.name,
        missionId: base.missionId,
        scopeJson: (dto.scope as unknown as Record<string, unknown>) ?? base.scopeJson,
        effectiveTime: dto.effectiveTime ? resolveAsOf(dto.effectiveTime) : base.effectiveTime,
        engineVersion: ENGINE_VERSION,
        revisionNo,
        status: CalculationScenarioStatus.DRAFT,
        basedOnId: base.id,
        hcSnapshotId: dto.hcSnapshotId ?? base.hcSnapshotId,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // LOCK bất biến: CALCULATED → LOCKED (đã có ≥1 run COMPLETED). DRAFT chưa chạy → không cho.
  async lockScenario(id: string, user: AuthUser): Promise<CalculationScenario> {
    const s = await this.getScenario(id);
    assertTransition(SCENARIO_TRANSITIONS as Record<string, string[]>, s.status, CalculationScenarioStatus.LOCKED);
    s.status = CalculationScenarioStatus.LOCKED;
    s.lockedAt = new Date();
    s.lockedBy = this.uid(user);
    s.updatedBy = this.uid(user);
    return this.scenarios.save(s);
  }

  // ======================= Chạy engine =======================
  async run(id: string, user: AuthUser): Promise<CalculationRun> {
    const scenario = await this.getScenario(id);
    assertScenarioEditable(scenario.status); // LOCKED/SUPERSEDED → LOCKED_IMMUTABLE (TC-DT08-011)

    const scope = (scenario.scopeJson ?? {}) as unknown as ScenarioScopeDto;
    const materials = scope.materials ?? [];
    const effectiveIso = scenario.effectiveTime.toISOString();

    const inputHash = computeInputHash({
      scenarioCode: scenario.scenarioCode,
      scope: scenario.scopeJson ?? {},
      effectiveTime: effectiveIso,
      engineVersion: ENGINE_VERSION,
      hcSnapshotId: scenario.hcSnapshotId,
    });

    // ---- HC as-of từ hc_snapshot (DT-04) — KHÔNG đọc số dư sống (BR-DT08-021) ----
    const orgFilter = scope.org ?? null;
    let snapshot: MaterielSnapshot | null = null;
    if (scenario.hcSnapshotId) {
      snapshot = await this.materielSnapshots.findOne({ where: { id: scenario.hcSnapshotId } });
    }
    const hcAvailable = !!snapshot;
    const hcMap = new Map<string, number>();
    if (snapshot) {
      const lines = await this.materielSnapshotLines.find({ where: { snapshotId: snapshot.id } });
      for (const line of lines) {
        if (orgFilter && line.organizationId && line.organizationId !== orgFilter) continue;
        hcMap.set(line.materialCatalogId, (hcMap.get(line.materialCatalogId) ?? 0) + Number(line.quantityOnHand));
      }
    }

    // ---- PC_SSCĐ từ DT-06 (SEM-RESERVE-SSCD) ----
    const reserve = await this.allocation.reserveSscd(orgFilter ?? undefined);
    const pcMap = new Map<string, number>();
    for (const it of reserve.items) pcMap.set(it.materialCatalogId, it.reservedQty);

    // ---- Resolve định mức theo giai đoạn cho từng vật chất (DT-07) ----
    const resolveScope = {
      mission: scope.mission,
      org: scope.org,
      territory: scope.territory,
      phase: scope.phase,
      quality: scope.quality,
      scale: scope.scale,
      time: scope.time,
    };
    const perMaterial: Array<{
      material: ScenarioMaterialDto;
      infos: PhaseResolveInfo[];
    }> = [];
    for (const m of materials) {
      const phases = m.phases && m.phases.length ? m.phases : [CalcPhase.PREPARATION, CalcPhase.COMBAT];
      const infos: PhaseResolveInfo[] = [];
      for (const phase of phases) {
        const semanticParam = PHASE_SEMANTIC[phase];
        const res = await this.norms.resolve(
          { materialCatalogId: m.materialCatalogId, semanticParam, scope: resolveScope, asOfTime: effectiveIso },
          user,
        );
        // SELECTED nhưng thiếu value số → coi như không dùng được (đánh dấu, không tính).
        const usable = res.status === 'SELECTED' && res.selected?.valueNumeric != null;
        infos.push({
          phase,
          semanticParam,
          status: usable ? 'SELECTED' : res.status === 'SELECTED' ? 'NO_RULE' : res.status,
          resolvedNormId: res.selected?.normId ?? null,
          valueNumeric: res.selected?.valueNumeric ?? null,
          valueType: res.selected?.valueType ?? null,
          sourceReference: this.formatSourceRef(res.sourceReference),
          trace: (res.trace ?? {}) as Record<string, unknown>,
        });
      }
      perMaterial.push({ material: m, infos });
    }

    // ---- Ghi kết quả (transaction — nguyên tử) ----
    return this.dataSource.transaction(async (mgr) => {
      const runRepo = mgr.getRepository(CalculationRun);
      const last = await runRepo.findOne({ where: { scenarioId: scenario.id }, order: { runNo: 'DESC' } });
      const run = await runRepo.save(
        runRepo.create({
          scenarioId: scenario.id,
          runNo: (last?.runNo ?? 0) + 1,
          inputHash,
          engineVersion: ENGINE_VERSION,
          status: CalculationRunStatus.RUNNING,
          startedAt: new Date(),
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );

      // Tham chiếu snapshot HC dùng cho run này.
      await mgr.getRepository(HcSnapshotRef).save(
        mgr.getRepository(HcSnapshotRef).create({
          runId: run.id,
          dt04SnapshotId: snapshot?.id ?? scenario.hcSnapshotId ?? null,
          asOfTime: snapshot?.asOfTime ?? null,
          scope: (resolveScope as unknown as Record<string, unknown>) ?? {},
          locked: snapshot?.locked ?? false,
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );

      const outputLines: Parameters<typeof computeOutputHash>[0] = [];
      let exceptionCount = 0;

      for (const { material, infos } of perMaterial) {
        const lineStatus = determineLineStatus(infos.length ? infos.map((i) => i.status) : ['NO_RULE']);
        const hcStatus: HcStatus = hcAvailable ? 'OK' : 'NO_HC_SNAPSHOT';
        const pcSscd = pcMap.get(material.materialCatalogId) ?? 0;
        const hcVal = hcMap.get(material.materialCatalogId) ?? 0;

        const prepInfo = infos.find((i) => i.phase === CalcPhase.PREPARATION && i.status === 'SELECTED');
        const combatInfo = infos.find((i) => i.phase === CalcPhase.COMBAT && i.status === 'SELECTED');
        const prep: PhaseContribution | null =
          prepInfo && prepInfo.valueNumeric != null
            ? { unitValue: prepInfo.valueNumeric, scale: material.scale ?? 1, days: material.daysPrep ?? 1 }
            : null;
        const combat: PhaseContribution | null =
          combatInfo && combatInfo.valueNumeric != null
            ? { unitValue: combatInfo.valueNumeric, scale: material.scale ?? 1, days: material.daysCombat ?? 1 }
            : null;

        // CHỈ tính khi định mức SELECTED và HC lấy được (OK). Ngược lại đánh dấu — KHÔNG quy 0.
        const computable = lineStatus === 'SELECTED' && hcStatus === 'OK';
        const need: NeedResult | null = computable
          ? computeMaterialNeed({ prep, combat, pcSscd, hc: hcVal })
          : null;
        if (!computable) exceptionCount++;

        const calc = await mgr.getRepository(MaterialCalculation).save(
          mgr.getRepository(MaterialCalculation).create({
            runId: run.id,
            materialCatalogId: material.materialCatalogId,
            phase: (material.phases && material.phases.length ? material.phases : ['PREPARATION', 'COMBAT']).join('+'),
            ttGdcb: need ? String(need.ttGdcb) : null,
            ttGdcd: need ? String(need.ttGdcd) : null,
            tt: need ? String(need.tt) : null,
            pcSscd: need ? String(need.pcSscd) : null,
            hc: need ? String(need.hc) : null,
            nc: need ? String(need.nc) : null,
            supplyRequired: need ? String(need.supplyRequired) : null,
            unitId: material.unitId ?? null,
            ruleStatus: lineStatus,
            hcStatus,
            createdBy: this.uid(user),
            updatedBy: this.uid(user),
          }),
        );

        // rule_resolution_snapshot cho từng giai đoạn (truy tới định mức + căn cứ).
        for (const info of infos) {
          await mgr.getRepository(RuleResolutionSnapshot).save(
            mgr.getRepository(RuleResolutionSnapshot).create({
              runId: run.id,
              materialCalculationId: calc.id,
              materialCatalogId: material.materialCatalogId,
              semanticParam: info.semanticParam,
              resolvedNormId: info.resolvedNormId,
              status: info.status,
              sourceReference: info.sourceReference,
              explanationJson: info.trace,
              createdBy: this.uid(user),
              updatedBy: this.uid(user),
            }),
          );
        }

        // Trace tới nguồn (BR-DT08-024): NORM × giai đoạn → RESERVE → HC → FORMULA.
        await this.writeTrace(mgr, run.id, calc.id, {
          infos,
          pcSscd,
          hcVal,
          hcStatus,
          snapshotId: snapshot?.id ?? scenario.hcSnapshotId ?? null,
          asOfIso: snapshot ? toHcmIso(snapshot.asOfTime) : null,
          need,
          user,
        });

        outputLines.push({
          materialCatalogId: material.materialCatalogId,
          ruleStatus: lineStatus,
          hcStatus,
          ttGdcb: need?.ttGdcb ?? null,
          ttGdcd: need?.ttGdcd ?? null,
          tt: need?.tt ?? null,
          pcSscd: need?.pcSscd ?? null,
          hc: need?.hc ?? null,
          nc: need?.nc ?? null,
          supplyRequired: need?.supplyRequired ?? null,
        });
      }

      run.outputHash = computeOutputHash(outputLines, ENGINE_VERSION);
      run.status = CalculationRunStatus.COMPLETED;
      run.finishedAt = new Date();
      run.lineCount = outputLines.length;
      run.exceptionCount = exceptionCount;
      run.updatedBy = this.uid(user);
      const savedRun = await runRepo.save(run);

      // DRAFT → CALCULATED sau lần chạy đầu.
      if (scenario.status === CalculationScenarioStatus.DRAFT) {
        const sRepo = mgr.getRepository(CalculationScenario);
        scenario.status = CalculationScenarioStatus.CALCULATED;
        scenario.updatedBy = this.uid(user);
        await sRepo.save(scenario);
      }

      await this.outbox.enqueue(mgr, {
        aggregateType: 'calculation_run',
        aggregateId: savedRun.id,
        eventType: 'calculation.run.completed',
        payload: { scenarioId: scenario.id, outputHash: savedRun.outputHash, exceptionCount },
      });

      return savedRun;
    });
  }

  private async writeTrace(
    mgr: EntityManager,
    runId: string,
    calcId: string,
    ctx: {
      infos: PhaseResolveInfo[];
      pcSscd: number;
      hcVal: number;
      hcStatus: HcStatus;
      snapshotId: string | null;
      asOfIso: string | null;
      need: NeedResult | null;
      user: AuthUser;
    },
  ): Promise<void> {
    const repo = mgr.getRepository(CalculationTraceNode);
    let seq = 0;
    const nodes: CalculationTraceNode[] = [];
    for (const info of ctx.infos) {
      nodes.push(
        repo.create({
          runId,
          materialCalculationId: calcId,
          seq: seq++,
          stepType: 'NORM',
          inputRefs: {
            phase: info.phase,
            semanticParam: info.semanticParam,
            normId: info.resolvedNormId,
            status: info.status,
            sourceReference: info.sourceReference,
            valueType: info.valueType,
          },
          formula: `Định mức ${info.semanticParam} = ${info.valueNumeric ?? '—'}`,
          outputValue: info.valueNumeric != null ? String(info.valueNumeric) : null,
          note: info.status !== 'SELECTED' ? `${info.status}: không dùng được (không quy 0)` : null,
          createdBy: this.uid(ctx.user),
          updatedBy: this.uid(ctx.user),
        }),
      );
    }
    nodes.push(
      repo.create({
        runId,
        materialCalculationId: calcId,
        seq: seq++,
        stepType: 'RESERVE',
        inputRefs: { source: 'DT-06 SEM-RESERVE-SSCD' },
        formula: 'PC_SSCĐ = dự trữ SSCĐ (DT-06)',
        outputValue: String(ctx.pcSscd),
        note: null,
        createdBy: this.uid(ctx.user),
        updatedBy: this.uid(ctx.user),
      }),
    );
    nodes.push(
      repo.create({
        runId,
        materialCalculationId: calcId,
        seq: seq++,
        stepType: 'HC',
        inputRefs: { source: 'DT-04 hc_snapshot', snapshotId: ctx.snapshotId, asOfTime: ctx.asOfIso, hcStatus: ctx.hcStatus },
        formula: 'HC = số hiện có as-of (hc_snapshot)',
        outputValue: ctx.hcStatus === 'OK' ? String(ctx.hcVal) : null,
        note: ctx.hcStatus === 'OK' ? null : 'NO_HC_SNAPSHOT: không đọc số dư sống (BR-DT08-021)',
        createdBy: this.uid(ctx.user),
        updatedBy: this.uid(ctx.user),
      }),
    );
    nodes.push(
      repo.create({
        runId,
        materialCalculationId: calcId,
        seq: seq++,
        stepType: 'FORMULA',
        inputRefs: ctx.need
          ? { ttGdcb: ctx.need.ttGdcb, ttGdcd: ctx.need.ttGdcd, tt: ctx.need.tt, pcSscd: ctx.need.pcSscd, hc: ctx.need.hc }
          : {},
        formula: ctx.need
          ? `NC = TT + PC_SSCĐ − HC = ${ctx.need.tt} + ${ctx.need.pcSscd} − ${ctx.need.hc} = ${ctx.need.nc}; supply_required = max(NC,0) = ${ctx.need.supplyRequired}`
          : 'Không tính (định mức/HC chưa sẵn sàng — không quy 0)',
        outputValue: ctx.need ? String(ctx.need.nc) : null,
        note: null,
        createdBy: this.uid(ctx.user),
        updatedBy: this.uid(ctx.user),
      }),
    );
    await repo.save(nodes);
  }

  private formatSourceRef(
    ref: { pageNo: number | null; lineRef: string | null; quoteText: string | null; appendixCode: string | null } | null | undefined,
  ): string | null {
    if (!ref) return null;
    const parts: string[] = [];
    if (ref.pageNo != null) parts.push(`tr.${ref.pageNo}`);
    if (ref.lineRef) parts.push(ref.lineRef);
    if (ref.appendixCode) parts.push(`PL ${ref.appendixCode}`);
    if (ref.quoteText) parts.push(`“${ref.quoteText}”`);
    return parts.length ? parts.join(' · ') : null;
  }

  // ======================= Truy vấn run =======================
  async getRun(id: string): Promise<CalculationRun> {
    const r = await this.runs.findOne({ where: { id } });
    if (!r) throw new NotFoundException(`DATA-001: Không có lần chạy ${id}`);
    return r;
  }

  listRuns(scenarioId: string) {
    return this.runs.find({ where: { scenarioId }, order: { runNo: 'DESC' } });
  }

  async runMaterials(runId: string) {
    await this.getRun(runId);
    return this.materialCalcs.find({ where: { runId }, order: { createdAt: 'ASC' } });
  }

  // Trace 1 dòng: tới định mức (source_reference) + HC snapshot + PC_SSCĐ (TC-DT08-024).
  async materialTrace(runId: string, materialCalcId: string) {
    const calc = await this.materialCalcs.findOne({ where: { id: materialCalcId, runId } });
    if (!calc) throw new NotFoundException(`DATA-001: Không có dòng tính ${materialCalcId}`);
    const [nodes, resolutions] = await Promise.all([
      this.traceNodes.find({ where: { materialCalculationId: materialCalcId }, order: { seq: 'ASC' } }),
      this.ruleSnaps.find({ where: { materialCalculationId: materialCalcId } }),
    ]);
    return { calculation: calc, trace: nodes, resolutions };
  }

  // Ngoại lệ: NO_RULE/CONFLICT/NO_HC_SNAPSHOT (SCR-DT08-05).
  async exceptions(runId: string) {
    await this.getRun(runId);
    const rows = await this.materialCalcs.find({ where: { runId } });
    return rows
      .filter((r) => r.ruleStatus !== 'SELECTED' || r.hcStatus !== 'OK')
      .map((r) => ({
        materialCalculationId: r.id,
        materialCatalogId: r.materialCatalogId,
        ruleStatus: r.ruleStatus,
        hcStatus: r.hcStatus,
        reason: r.ruleStatus !== 'SELECTED' ? r.ruleStatus : 'NO_HC_SNAPSHOT',
      }));
  }

  // supply_required cho DT-09 (GET /runs/{id}/supply-required). Chỉ dòng đã tính (SELECTED + HC OK).
  async supplyRequired(runId: string) {
    const run = await this.getRun(runId);
    const rows = await this.materialCalcs.find({ where: { runId } });
    const items = rows
      .filter((r) => r.ruleStatus === 'SELECTED' && r.hcStatus === 'OK' && r.supplyRequired != null)
      .map((r) => ({
        materialCatalogId: r.materialCatalogId,
        supplyRequired: Number(r.supplyRequired),
        nc: r.nc != null ? Number(r.nc) : null,
        unitId: r.unitId,
      }));
    const pending = rows.filter((r) => r.ruleStatus !== 'SELECTED' || r.hcStatus !== 'OK').length;
    return {
      runId: run.id,
      scenarioId: run.scenarioId,
      outputHash: run.outputHash,
      engineVersion: run.engineVersion,
      locked: run.status === CalculationRunStatus.COMPLETED,
      pendingExceptions: pending,
      items,
    };
  }

  // So sánh 2 run: ΔNC theo vật chất + lưu scenario_comparison (SCR-DT08-06).
  async compare(baseRunId: string, targetRunId: string, user: AuthUser) {
    const [base, target] = await Promise.all([this.getRun(baseRunId), this.getRun(targetRunId)]);
    const [baseRows, targetRows] = await Promise.all([
      this.materialCalcs.find({ where: { runId: baseRunId } }),
      this.materialCalcs.find({ where: { runId: targetRunId } }),
    ]);
    const toLike = (r: MaterialCalculation) => ({
      materialCatalogId: r.materialCatalogId,
      nc: r.nc != null ? Number(r.nc) : null,
      supplyRequired: r.supplyRequired != null ? Number(r.supplyRequired) : null,
      ruleStatus: r.ruleStatus,
    });
    const delta: CompareLine[] = compareRuns(baseRows.map(toLike), targetRows.map(toLike));
    const changed = delta.filter((d) => d.changed).length;
    await this.comparisons.save(
      this.comparisons.create({
        baseRunId,
        targetRunId,
        deltaJson: { lines: delta, changed, baseOutputHash: base.outputHash, targetOutputHash: target.outputHash },
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    return { baseRunId, targetRunId, changed, lines: delta };
  }
}
