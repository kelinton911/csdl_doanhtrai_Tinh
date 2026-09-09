import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { buildScopeContext } from '../../common/scope/scope-context';
import { applyJsonOrgScope, assertReadScope } from '../../common/scope/scope-query';
import { resolveAsOf } from '../../common/time/as-of';
import { OutboxService } from '../../common/outbox/outbox.service';
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
import {
  AlertInstanceStatus,
  DT12_ENGINE_VERSION,
  DecisionSessionStatus,
  FactType,
  FreshnessStatus,
  KpiDefinitionStatus,
  KpiFormulaVersionStatus,
  Semantic,
  SEMANTICS,
  ThresholdDirection,
} from './dt12.enums';
import {
  assertAlertTransition,
  computeMetricHash,
  evaluateThreshold,
  resolveFreshness,
  scoreOptions,
  slaDueAt,
  toNum,
  type MetricPayload,
} from './dt12-rules';
import { drillDownSemantic, resolveSemantic, type SemanticContext, type SemanticScope } from './semantic-sources';
import {
  AckAlertDto,
  AddCriterionDto,
  AddOptionDto,
  AssignAlertDto,
  ComputeMetricDto,
  CreateAlertRuleDto,
  CreateDecisionSessionDto,
  CreateFormulaVersionDto,
  CreateKpiDefinitionDto,
  CreateThresholdDto,
  DataMartRefreshDto,
  EvaluateAlertsDto,
  RecordDecisionDto,
  ResolveAlertDto,
  ScoreDto,
} from './dto/dt12.dto';

// DT-12 — Dashboard chỉ huy. Semantic/KPI (metric có as_of_time + lineage + freshness) + Data Mart (refresh qua
// outbox, dẫn xuất) + alert lifecycle + decision what-if cách ly. KHÔNG tạo "số Dashboard" độc lập (AC-15).
@Injectable()
export class Dt12Service {
  constructor(
    @InjectRepository(KpiDefinition) private readonly kpis: Repository<KpiDefinition>,
    @InjectRepository(KpiFormulaVersion) private readonly formulas: Repository<KpiFormulaVersion>,
    @InjectRepository(KpiThreshold) private readonly thresholds: Repository<KpiThreshold>,
    @InjectRepository(MetricInstance) private readonly metrics: Repository<MetricInstance>,
    @InjectRepository(DataMartRefresh) private readonly refreshes: Repository<DataMartRefresh>,
    @InjectRepository(DimMaterial) private readonly dimMaterial: Repository<DimMaterial>,
    @InjectRepository(DimOrg) private readonly dimOrg: Repository<DimOrg>,
    @InjectRepository(DimTime) private readonly dimTime: Repository<DimTime>,
    @InjectRepository(DimQuality) private readonly dimQuality: Repository<DimQuality>,
    @InjectRepository(FactInventory) private readonly factInventory: Repository<FactInventory>,
    @InjectRepository(FactRequirement) private readonly factRequirement: Repository<FactRequirement>,
    @InjectRepository(FactBalance) private readonly factBalance: Repository<FactBalance>,
    @InjectRepository(FactCount) private readonly factCount: Repository<FactCount>,
    @InjectRepository(AlertRule) private readonly alertRules: Repository<AlertRule>,
    @InjectRepository(AlertInstance) private readonly alerts: Repository<AlertInstance>,
    @InjectRepository(AlertAssignment) private readonly assignments: Repository<AlertAssignment>,
    @InjectRepository(DecisionSession) private readonly sessions: Repository<DecisionSession>,
    @InjectRepository(DecisionOption) private readonly options: Repository<DecisionOption>,
    @InjectRepository(DecisionCriterion) private readonly criteria: Repository<DecisionCriterion>,
    @InjectRepository(DecisionScore) private readonly scores: Repository<DecisionScore>,
    @InjectRepository(DecisionRecord) private readonly records: Repository<DecisionRecord>,
    // Nguồn snapshot chuẩn (chỉ đọc — bất biến):
    @InjectRepository(MaterielSnapshot) private readonly materielSnapshots: Repository<MaterielSnapshot>,
    @InjectRepository(MaterielSnapshotLine) private readonly materielLines: Repository<MaterielSnapshotLine>,
    @InjectRepository(AllocationHold) private readonly allocationHolds: Repository<AllocationHold>,
    @InjectRepository(AllocationSnapshot) private readonly allocationSnapshots: Repository<AllocationSnapshot>,
    @InjectRepository(AllocationSnapshotLine) private readonly allocationSnapshotLines: Repository<AllocationSnapshotLine>,
    @InjectRepository(CalculationRun) private readonly calcRuns: Repository<CalculationRun>,
    @InjectRepository(MaterialCalculation) private readonly materialCalcs: Repository<MaterialCalculation>,
    @InjectRepository(BalanceSnapshot) private readonly balanceSnapshots: Repository<BalanceSnapshot>,
    @InjectRepository(BalanceSnapshotLine) private readonly balanceLines: Repository<BalanceSnapshotLine>,
    @InjectRepository(OfficialSnapshot) private readonly officialSnapshots: Repository<OfficialSnapshot>,
    @InjectRepository(OfficialSnapshotLine) private readonly officialLines: Repository<OfficialSnapshotLine>,
    private readonly outbox: OutboxService,
    private readonly ds: DataSource,
  ) {}

  private uid(user: AuthUser): string | null {
    return user?.sub ?? null;
  }

  private semCtx(): SemanticContext {
    return {
      materielSnapshots: this.materielSnapshots,
      materielLines: this.materielLines,
      allocationHolds: this.allocationHolds,
      allocationSnapshots: this.allocationSnapshots,
      allocationSnapshotLines: this.allocationSnapshotLines,
      calcRuns: this.calcRuns,
      materialCalcs: this.materialCalcs,
      balanceSnapshots: this.balanceSnapshots,
      balanceLines: this.balanceLines,
      officialSnapshots: this.officialSnapshots,
      officialLines: this.officialLines,
    };
  }

  private toSemanticScope(scopeJson?: Record<string, unknown>): SemanticScope {
    return {
      organizationId: (scopeJson?.organizationId as string) ?? null,
      areaIds: (scopeJson?.areaIds as string[]) ?? [],
    };
  }

  private userSemanticScope(user: AuthUser): SemanticScope {
    const s = buildScopeContext(user);
    return { organizationId: s.provinceWide ? null : s.organizationId, areaIds: s.areaIds };
  }

  // ================= KPI definition / formula / threshold =================
  async createKpi(dto: CreateKpiDefinitionDto, user: AuthUser): Promise<KpiDefinition> {
    const dup = await this.kpis.findOne({ where: { kpiCode: dto.kpiCode } });
    if (dup) throw new BusinessException(BusinessError.STALE_WRITE, `KPI ${dto.kpiCode} đã tồn tại`);
    return this.kpis.save(
      this.kpis.create({
        kpiCode: dto.kpiCode,
        name: dto.name,
        semanticRef: dto.semanticRef as Semantic,
        unit: dto.unit ?? null,
        description: dto.description ?? null,
        status: KpiDefinitionStatus.ACTIVE,
        currentVersionNo: 0,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listKpis(): Promise<KpiDefinition[]> {
    return this.kpis.find({ order: { kpiCode: 'ASC' } });
  }

  async getKpi(id: string): Promise<KpiDefinition> {
    const k = await this.kpis.findOne({ where: { id } });
    if (!k) throw new NotFoundException('Không tìm thấy KPI');
    return k;
  }

  private async getKpiByCode(kpiCode: string): Promise<KpiDefinition> {
    const k = await this.kpis.findOne({ where: { kpiCode } });
    if (!k) throw new NotFoundException(`Không tìm thấy KPI ${kpiCode}`);
    return k;
  }

  async addFormulaVersion(kpiId: string, dto: CreateFormulaVersionDto, user: AuthUser): Promise<KpiFormulaVersion> {
    const kpi = await this.getKpi(kpiId);
    const last = await this.formulas.find({ where: { kpiDefinitionId: kpi.id }, order: { versionNo: 'DESC' }, take: 1 });
    const versionNo = (last[0]?.versionNo ?? 0) + 1;
    const activate = !!dto.activate;
    if (activate) {
      await this.formulas.update(
        { kpiDefinitionId: kpi.id, status: KpiFormulaVersionStatus.ACTIVE },
        { status: KpiFormulaVersionStatus.SUPERSEDED },
      );
    }
    const fv = await this.formulas.save(
      this.formulas.create({
        kpiDefinitionId: kpi.id,
        versionNo,
        formulaExpr: dto.formulaExpr ?? 'SUM(semantic)',
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        status: activate ? KpiFormulaVersionStatus.ACTIVE : KpiFormulaVersionStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    if (activate) {
      kpi.currentVersionNo = versionNo;
      kpi.updatedBy = this.uid(user);
      await this.kpis.save(kpi);
    }
    return fv;
  }

  listFormulaVersions(kpiId: string): Promise<KpiFormulaVersion[]> {
    return this.formulas.find({ where: { kpiDefinitionId: kpiId }, order: { versionNo: 'DESC' } });
  }

  async addThreshold(kpiId: string, dto: CreateThresholdDto, user: AuthUser): Promise<KpiThreshold> {
    await this.getKpi(kpiId);
    return this.thresholds.save(
      this.thresholds.create({
        kpiDefinitionId: kpiId,
        scopeJson: dto.scopeJson ?? {},
        warnLevel: dto.warnLevel !== undefined ? String(dto.warnLevel) : null,
        criticalLevel: dto.criticalLevel !== undefined ? String(dto.criticalLevel) : null,
        direction: dto.direction as ThresholdDirection,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listThresholds(kpiId: string): Promise<KpiThreshold[]> {
    return this.thresholds.find({ where: { kpiDefinitionId: kpiId }, order: { createdAt: 'ASC' } });
  }

  // ================= metric_instance =================
  async computeMetric(dto: ComputeMetricDto, user: AuthUser): Promise<MetricInstance> {
    const kpi = await this.getKpiByCode(dto.kpiCode);
    const scopeJson = dto.scopeJson ?? {};
    const scope = this.toSemanticScope(scopeJson);
    const asOf = resolveAsOf(dto.asOf);
    const sem = await resolveSemantic(this.semCtx(), kpi.semanticRef, scope);
    const payload: MetricPayload = {
      engineVersion: DT12_ENGINE_VERSION,
      kpiCode: kpi.kpiCode,
      semantic: kpi.semanticRef,
      scope: scopeJson,
      asOf: asOf.toISOString(),
      value: sem.value,
      lineage: sem.lineage,
    };
    const metricHash = computeMetricHash(payload);
    // Tính từ snapshot mới nhất ⇒ FRESH (hoặc NO_SOURCE nếu chưa có nguồn nào).
    const freshness = resolveFreshness(sem.sourceVersion, sem.sourceVersion);
    return this.metrics.save(
      this.metrics.create({
        kpiDefinitionId: kpi.id,
        scopeJson,
        asOfTime: asOf,
        value: sem.value !== null ? String(sem.value) : null,
        sourceAsOf: sem.sourceAsOf,
        sourceVersion: sem.sourceVersion,
        lineageJson: sem.lineage,
        freshnessStatus: freshness,
        metricHash,
        computedAt: new Date(),
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // Tính freshness SỐNG: so source_version đã chốt với phiên bản nguồn hiện tại (nguồn mới hơn ⇒ STALE).
  private async liveFreshness(kpi: KpiDefinition, m: MetricInstance): Promise<FreshnessStatus> {
    const cur = await resolveSemantic(this.semCtx(), kpi.semanticRef, this.toSemanticScope(m.scopeJson));
    return resolveFreshness(m.sourceVersion, cur.sourceVersion);
  }

  private async withFreshness(m: MetricInstance): Promise<MetricInstance & { latestSourceVersion: string | null }> {
    const kpi = await this.getKpi(m.kpiDefinitionId);
    const cur = await resolveSemantic(this.semCtx(), kpi.semanticRef, this.toSemanticScope(m.scopeJson));
    m.freshnessStatus = resolveFreshness(m.sourceVersion, cur.sourceVersion);
    return Object.assign(m, { latestSourceVersion: cur.sourceVersion });
  }

  async listMetrics(query: { kpiCode?: string; asOf?: string }, user?: AuthUser): Promise<Array<MetricInstance & { latestSourceVersion: string | null }>> {
    const qb = this.metrics.createQueryBuilder('mi').orderBy('mi.computed_at', 'DESC').take(100);
    if (query.kpiCode) {
      const kpi = await this.getKpiByCode(query.kpiCode);
      qb.andWhere('mi.kpi_definition_id = :k', { k: kpi.id });
    }
    applyJsonOrgScope(qb, 'mi', user); // SYS-BR-08: org trong scope_json
    const rows = await qb.getMany();
    return Promise.all(rows.map((m) => this.withFreshness(m)));
  }

  async getMetric(id: string): Promise<MetricInstance> {
    const m = await this.metrics.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Không tìm thấy metric_instance');
    return m;
  }

  async getMetricLineage(id: string) {
    const m = await this.getMetric(id);
    const kpi = await this.getKpi(m.kpiDefinitionId);
    return {
      metricInstanceId: m.id,
      kpiCode: kpi.kpiCode,
      semantic: kpi.semanticRef,
      asOfTime: m.asOfTime,
      value: m.value !== null ? Number(m.value) : null,
      sourceAsOf: m.sourceAsOf,
      sourceVersion: m.sourceVersion,
      freshness: await this.liveFreshness(kpi, m),
      lineage: m.lineageJson, // mọi metric có lineage — AC-15
    };
  }

  async getMetricDrillDown(id: string) {
    const m = await this.getMetric(id);
    const kpi = await this.getKpi(m.kpiDefinitionId);
    const dd = await drillDownSemantic(this.semCtx(), kpi.semanticRef, this.toSemanticScope(m.scopeJson));
    const total = dd.rows.reduce((s, r) => s + (r.value ?? 0), 0);
    return {
      metricInstanceId: m.id,
      kpiCode: kpi.kpiCode,
      semantic: kpi.semanticRef,
      sourceType: dd.sourceType,
      metricValue: m.value !== null ? Number(m.value) : null,
      drillDownTotal: total,
      rows: dd.rows,
    };
  }

  // ================= semantic explorer =================
  async semantics(user: AuthUser, scopeJson?: Record<string, unknown>) {
    const scope = scopeJson ? this.toSemanticScope(scopeJson) : this.userSemanticScope(user);
    const items = [];
    for (const s of SEMANTICS) {
      const r = await resolveSemantic(this.semCtx(), s as Semantic, scope);
      items.push({
        semantic: s,
        value: r.value,
        sourceAsOf: r.sourceAsOf,
        sourceVersion: r.sourceVersion,
        freshness: r.sourceVersion ? FreshnessStatus.FRESH : FreshnessStatus.NO_SOURCE,
        lineage: r.lineage,
      });
    }
    return { generatedAt: new Date().toISOString(), scope, items };
  }

  // ================= Data Mart (refresh qua outbox; dẫn xuất) =================
  private async ensureDimMaterial(m: EntityManager, id: string, cache: Map<string, string>): Promise<string> {
    if (cache.has(id)) return cache.get(id)!;
    const repo = m.getRepository(DimMaterial);
    let row = await repo.findOne({ where: { materialCatalogId: id } });
    if (!row) row = await repo.save(repo.create({ materialCatalogId: id }));
    cache.set(id, row.id);
    return row.id;
  }
  private async ensureDimOrg(m: EntityManager, id: string, cache: Map<string, string>): Promise<string> {
    if (cache.has(id)) return cache.get(id)!;
    const repo = m.getRepository(DimOrg);
    let row = await repo.findOne({ where: { orgId: id } });
    if (!row) row = await repo.save(repo.create({ orgId: id }));
    cache.set(id, row.id);
    return row.id;
  }
  private async ensureDimTime(m: EntityManager, d: Date): Promise<string> {
    const dateKey = d.toISOString().slice(0, 10);
    const repo = m.getRepository(DimTime);
    let row = await repo.findOne({ where: { dateKey } });
    if (!row) row = await repo.save(repo.create({ dateKey, isoTime: d }));
    return row.id;
  }

  // Refresh 1 fact: rebuild toàn phần từ snapshot mới nhất, TRONG transaction (nguyên tử), qua EntityManager.
  async refreshDataMart(dto: DataMartRefreshDto, user: AuthUser): Promise<DataMartRefresh> {
    const factType = dto.factType as FactType;
    const matCache = new Map<string, string>();
    const orgCache = new Map<string, string>();
    let sourceVersion: string | null = null;
    let rowCount = 0;
    const refreshId = randomUUID();

    await this.ds.transaction(async (m) => {
      if (factType === FactType.INVENTORY) {
        await m.getRepository(FactInventory).createQueryBuilder().delete().execute();
        const snap = (await m.getRepository(MaterielSnapshot).find({ order: { asOfTime: 'DESC' }, take: 1 }))[0] ?? null;
        if (snap) {
          sourceVersion = `${snap.snapshotCode}:${snap.checksum ?? snap.asOfTime.toISOString()}`;
          const dimT = await this.ensureDimTime(m, snap.asOfTime);
          const lines = await m.getRepository(MaterielSnapshotLine).find({ where: { snapshotId: snap.id } });
          const repo = m.getRepository(FactInventory);
          for (const l of lines) {
            const dm = await this.ensureDimMaterial(m, l.materialCatalogId, matCache);
            const doi = l.organizationId ? await this.ensureDimOrg(m, l.organizationId, orgCache) : null;
            await repo.save(
              repo.create({
                refreshId,
                dimMaterialId: dm,
                dimOrgId: doi,
                dimTimeId: dimT,
                onHand: l.quantityOnHand,
                available: null,
                snapshotRef: { sourceType: 'DT04_MATERIEL_SNAPSHOT', snapshotId: snap.id, snapshotCode: snap.snapshotCode, lineId: l.id },
              }),
            );
            rowCount++;
          }
        }
      } else if (factType === FactType.REQUIREMENT) {
        await m.getRepository(FactRequirement).createQueryBuilder().delete().execute();
        const run = (await m.getRepository(CalculationRun).find({ order: { createdAt: 'DESC' }, take: 1 }))[0] ?? null;
        if (run) {
          sourceVersion = run.outputHash ?? run.id;
          const dimT = await this.ensureDimTime(m, run.finishedAt ?? run.createdAt ?? new Date());
          const calcs = await m.getRepository(MaterialCalculation).find({ where: { runId: run.id } });
          const repo = m.getRepository(FactRequirement);
          for (const c of calcs) {
            const dm = await this.ensureDimMaterial(m, c.materialCatalogId, matCache);
            await repo.save(
              repo.create({
                refreshId,
                dimMaterialId: dm,
                dimTimeId: dimT,
                tt: c.tt,
                pcSscd: c.pcSscd,
                hc: c.hc,
                nc: c.nc,
                supplyRequired: c.supplyRequired,
                runRef: { sourceType: 'DT08_CALCULATION_RUN', runId: run.id, outputHash: run.outputHash },
              }),
            );
            rowCount++;
          }
        }
      } else if (factType === FactType.BALANCE) {
        await m.getRepository(FactBalance).createQueryBuilder().delete().execute();
        const snap = (await m.getRepository(BalanceSnapshot).find({ order: { approvedAt: 'DESC' }, take: 1 }))[0] ?? null;
        if (snap) {
          sourceVersion = snap.checksum;
          const dimT = await this.ensureDimTime(m, snap.approvedAt);
          const lines = await m.getRepository(BalanceSnapshotLine).find({ where: { snapshotId: snap.id } });
          const repo = m.getRepository(FactBalance);
          for (const l of lines) {
            const dm = await this.ensureDimMaterial(m, l.materialCatalogId, matCache);
            await repo.save(
              repo.create({
                refreshId,
                dimMaterialId: dm,
                dimTimeId: dimT,
                supplyRequired: l.supplyRequired,
                plannedSource: l.plannedSourceQty,
                gap: l.gapQty,
                snapshotRef: { sourceType: 'DT09_BALANCE_SNAPSHOT', snapshotId: snap.id, lineId: l.id },
              }),
            );
            rowCount++;
          }
        }
      } else if (factType === FactType.COUNT) {
        await m.getRepository(FactCount).createQueryBuilder().delete().execute();
        const snap = (await m.getRepository(OfficialSnapshot).find({ order: { version: 'DESC' }, take: 1 }))[0] ?? null;
        if (snap) {
          sourceVersion = `${snap.campaignId}:v${snap.version}:${snap.checksum}`;
          const dimT = await this.ensureDimTime(m, snap.approvedAt ?? snap.createdAt ?? new Date());
          const lines = await m.getRepository(OfficialSnapshotLine).find({ where: { snapshotId: snap.id } });
          const repo = m.getRepository(FactCount);
          for (const l of lines) {
            const dm = await this.ensureDimMaterial(m, l.materialCatalogId, matCache);
            await repo.save(
              repo.create({
                refreshId,
                dimMaterialId: dm,
                dimTimeId: dimT,
                officialQty: l.officialQty,
                snapshotRef: { sourceType: 'DT10_OFFICIAL_SNAPSHOT', snapshotId: snap.id, version: snap.version, lineId: l.id },
              }),
            );
            rowCount++;
          }
        }
      }
    });

    // Ghi outbox: refresh là DẪN XUẤT qua outbox (không sửa tay).
    const evt = await this.outbox.emit({
      aggregateType: 'data_mart',
      aggregateId: refreshId,
      eventType: 'DATA_MART_REFRESHED',
      payload: { factType, sourceVersion, rowCount },
    });

    return this.refreshes.save(
      this.refreshes.create({
        factType,
        sourceRefJson: dto.sourceRef ?? {},
        sourceVersion,
        refreshedAt: new Date(),
        rowCount,
        outboxEventId: evt.id,
        freshnessStatus: sourceVersion ? FreshnessStatus.FRESH : FreshnessStatus.NO_SOURCE,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  // Freshness Data Mart: so source_version của lần refresh gần nhất mỗi fact với phiên bản nguồn hiện tại.
  async dataMartFreshness() {
    const currentVersions: Record<FactType, string | null> = {
      [FactType.INVENTORY]: null,
      [FactType.REQUIREMENT]: null,
      [FactType.BALANCE]: null,
      [FactType.COUNT]: null,
    };
    const inv = (await this.materielSnapshots.find({ order: { asOfTime: 'DESC' }, take: 1 }))[0];
    if (inv) currentVersions[FactType.INVENTORY] = `${inv.snapshotCode}:${inv.checksum ?? inv.asOfTime.toISOString()}`;
    const run = (await this.calcRuns.find({ order: { createdAt: 'DESC' }, take: 1 }))[0];
    if (run) currentVersions[FactType.REQUIREMENT] = run.outputHash ?? run.id;
    const bal = (await this.balanceSnapshots.find({ order: { approvedAt: 'DESC' }, take: 1 }))[0];
    if (bal) currentVersions[FactType.BALANCE] = bal.checksum;
    const off = (await this.officialSnapshots.find({ order: { version: 'DESC' }, take: 1 }))[0];
    if (off) currentVersions[FactType.COUNT] = `${off.campaignId}:v${off.version}:${off.checksum}`;

    const items = [];
    for (const ft of Object.values(FactType)) {
      const last = (await this.refreshes.find({ where: { factType: ft }, order: { refreshedAt: 'DESC' }, take: 1 }))[0] ?? null;
      const freshness = resolveFreshness(last?.sourceVersion ?? null, currentVersions[ft]);
      items.push({
        factType: ft,
        lastRefreshedAt: last?.refreshedAt ?? null,
        refreshedVersion: last?.sourceVersion ?? null,
        currentVersion: currentVersions[ft],
        rowCount: last?.rowCount ?? 0,
        freshness,
      });
    }
    return { generatedAt: new Date().toISOString(), items };
  }

  // ================= alert_rule / alert_instance =================
  async createAlertRule(dto: CreateAlertRuleDto, user: AuthUser): Promise<AlertRule> {
    const kpi = await this.getKpiByCode(dto.kpiCode);
    const dup = await this.alertRules.findOne({ where: { ruleCode: dto.ruleCode } });
    if (dup) throw new BusinessException(BusinessError.STALE_WRITE, `Rule ${dto.ruleCode} đã tồn tại`);
    return this.alertRules.save(
      this.alertRules.create({
        ruleCode: dto.ruleCode,
        name: dto.name,
        kpiDefinitionId: kpi.id,
        scopeJson: dto.scopeJson ?? {},
        warnLevel: dto.warnLevel !== undefined ? String(dto.warnLevel) : null,
        criticalLevel: dto.criticalLevel !== undefined ? String(dto.criticalLevel) : null,
        direction: dto.direction as ThresholdDirection,
        slaHours: dto.slaHours ?? 72,
        status: KpiDefinitionStatus.ACTIVE,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  listAlertRules(): Promise<AlertRule[]> {
    return this.alertRules.find({ order: { ruleCode: 'ASC' } });
  }

  // Quét rule ACTIVE → tính metric KPI → so ngưỡng → sinh alert_instance (severity + SLA). Gom trùng theo dedupe_key.
  async evaluateAlerts(dto: EvaluateAlertsDto, user: AuthUser): Promise<{ evaluated: number; created: number; alerts: AlertInstance[] }> {
    const asOf = resolveAsOf(dto.asOf);
    const rules = dto.ruleCode
      ? await this.alertRules.find({ where: { ruleCode: dto.ruleCode } })
      : await this.alertRules.find({ where: { status: KpiDefinitionStatus.ACTIVE } });
    const created: AlertInstance[] = [];
    let evaluated = 0;
    for (const rule of rules) {
      evaluated++;
      const kpi = await this.getKpi(rule.kpiDefinitionId);
      const scope = this.toSemanticScope(rule.scopeJson);
      const sem = await resolveSemantic(this.semCtx(), kpi.semanticRef, scope);
      const value = sem.value;
      const severity = evaluateThreshold(value, {
        warnLevel: rule.warnLevel !== null ? Number(rule.warnLevel) : null,
        criticalLevel: rule.criticalLevel !== null ? Number(rule.criticalLevel) : null,
        direction: rule.direction,
      });
      if (!severity) continue;
      const dedupeKey = `${rule.ruleCode}:${JSON.stringify(rule.scopeJson ?? {})}:${severity}`;
      const existing = await this.alerts.findOne({
        where: [
          { ruleId: rule.id, dedupeKey, status: AlertInstanceStatus.OPEN },
          { ruleId: rule.id, dedupeKey, status: AlertInstanceStatus.ACK },
        ],
      });
      if (existing) continue; // gom trùng — đang xử lý, không nhân đôi
      // Lưu metric làm bằng chứng (có lineage) rồi gắn vào alert.
      const metric = await this.computeMetric({ kpiCode: kpi.kpiCode, scopeJson: rule.scopeJson, asOf: asOf.toISOString() }, user);
      const saved = await this.alerts.save(
        this.alerts.create({
          ruleId: rule.id,
          kpiDefinitionId: kpi.id,
          metricInstanceId: metric.id,
          scopeJson: rule.scopeJson ?? {},
          asOfTime: asOf,
          value: value !== null ? String(value) : null,
          severity,
          status: AlertInstanceStatus.OPEN,
          dedupeKey,
          dueAt: slaDueAt(asOf, rule.slaHours),
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
      created.push(saved);
    }
    return { evaluated, created: created.length, alerts: created };
  }

  listAlerts(filters: { status?: string; severity?: string }, user?: AuthUser): Promise<AlertInstance[]> {
    const qb = this.alerts
      .createQueryBuilder('ai')
      .orderBy('ai.severity', 'DESC')
      .addOrderBy('ai.created_at', 'DESC')
      .take(200);
    if (filters.status) qb.andWhere('ai.status = :st', { st: filters.status });
    if (filters.severity) qb.andWhere('ai.severity = :sv', { sv: filters.severity });
    applyJsonOrgScope(qb, 'ai', user); // SYS-BR-08
    return qb.getMany();
  }

  private async getAlert(id: string): Promise<AlertInstance> {
    const a = await this.alerts.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Không tìm thấy cảnh báo');
    return a;
  }

  async ackAlert(id: string, dto: AckAlertDto, user: AuthUser): Promise<AlertInstance> {
    const a = await this.getAlert(id);
    assertAlertTransition(a.status, AlertInstanceStatus.ACK);
    a.status = AlertInstanceStatus.ACK;
    a.ackedAt = new Date();
    if (dto.note) a.resolution = dto.note; // ghi chú tiếp nhận (chưa resolve)
    a.updatedBy = this.uid(user);
    return this.alerts.save(a);
  }

  async resolveAlert(id: string, dto: ResolveAlertDto, user: AuthUser): Promise<AlertInstance> {
    const a = await this.getAlert(id);
    assertAlertTransition(a.status, AlertInstanceStatus.RESOLVED);
    a.status = AlertInstanceStatus.RESOLVED;
    a.resolvedAt = new Date();
    a.resolution = dto.resolution;
    a.updatedBy = this.uid(user);
    return this.alerts.save(a);
  }

  async assignAlert(id: string, dto: AssignAlertDto, user: AuthUser): Promise<{ alert: AlertInstance; assignment: AlertAssignment }> {
    const a = await this.getAlert(id);
    if (a.status === AlertInstanceStatus.RESOLVED)
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, 'Cảnh báo đã RESOLVED');
    const assignment = await this.assignments.save(
      this.assignments.create({
        alertInstanceId: a.id,
        assigneeId: dto.assigneeId,
        assignedAt: new Date(),
        note: dto.note ?? null,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    return { alert: a, assignment };
  }

  // ================= decision (what-if cách ly) =================
  private genCode(prefix: string): string {
    return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
  }

  async createSession(dto: CreateDecisionSessionDto, user: AuthUser): Promise<DecisionSession> {
    // Chụp baseline: 7 semantic hiện trạng (có lineage) — làm mốc so sánh, KHÔNG ghi ngược vận hành.
    const scope = this.toSemanticScope(dto.scopeJson);
    const baseline: Record<string, unknown> = {};
    for (const s of SEMANTICS) {
      const r = await resolveSemantic(this.semCtx(), s as Semantic, scope);
      baseline[s] = { value: r.value, sourceVersion: r.sourceVersion, lineage: r.lineage };
    }
    return this.sessions.save(
      this.sessions.create({
        sessionCode: this.genCode('DEC'),
        title: dto.title,
        scopeJson: dto.scopeJson ?? {},
        baselineJson: baseline,
        paramsJson: dto.paramsJson ?? {},
        status: DecisionSessionStatus.DRAFT,
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  private async getSession(id: string): Promise<DecisionSession> {
    const s = await this.sessions.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Không tìm thấy phiên quyết định');
    return s;
  }

  async addOption(sessionId: string, dto: AddOptionDto, user: AuthUser): Promise<DecisionOption> {
    await this.getSession(sessionId);
    return this.options.save(
      this.options.create({
        sessionId,
        optionKey: dto.optionKey,
        label: dto.label,
        paramsJson: dto.paramsJson ?? {},
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async addCriterion(sessionId: string, dto: AddCriterionDto, user: AuthUser): Promise<DecisionCriterion> {
    await this.getSession(sessionId);
    return this.criteria.save(
      this.criteria.create({
        sessionId,
        criterionKey: dto.criterionKey,
        label: dto.label,
        weight: String(dto.weight ?? 1),
        direction: dto.direction ?? 'HIGHER_BETTER',
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
  }

  async score(sessionId: string, dto: ScoreDto, user: AuthUser) {
    const session = await this.getSession(sessionId);
    const opts = await this.options.find({ where: { sessionId } });
    const crits = await this.criteria.find({ where: { sessionId } });
    const optByKey = new Map(opts.map((o) => [o.optionKey, o]));
    const critByKey = new Map(crits.map((c) => [c.criterionKey, c]));
    const scoreInputs = dto.scores.map((s) => {
      const o = optByKey.get(s.optionKey);
      const c = critByKey.get(s.criterionKey);
      if (!o || !c) throw new BusinessException(BusinessError.DATA_CONTRACT_MISMATCH, `option/criterion không tồn tại: ${s.optionKey}/${s.criterionKey}`);
      return { optionId: o.id, criterionId: c.id, rawValue: s.rawValue ?? null };
    });
    const critInputs = crits.map((c) => ({ criterionId: c.id, weight: Number(c.weight), direction: c.direction as 'HIGHER_BETTER' | 'LOWER_BETTER' }));
    const { rows, ranking } = scoreOptions(scoreInputs, critInputs);

    // Ghi lại điểm (thay bộ cũ). CÁCH LY: chỉ ghi decision_score.
    await this.scores.delete({ sessionId });
    for (const r of rows) {
      await this.scores.save(
        this.scores.create({
          sessionId,
          optionId: r.optionId,
          criterionId: r.criterionId,
          rawValue: r.rawValue !== null ? String(r.rawValue) : null,
          normalized: r.normalized !== null ? String(r.normalized) : null,
          weighted: r.weighted !== null ? String(r.weighted) : null,
          createdBy: this.uid(user),
          updatedBy: this.uid(user),
        }),
      );
    }
    session.status = DecisionSessionStatus.SCORED;
    session.updatedBy = this.uid(user);
    await this.sessions.save(session);
    const rankingWithKeys = ranking.map((r) => ({ optionKey: opts.find((o) => o.id === r.optionId)?.optionKey, total: r.total }));
    return { sessionId, ranking: rankingWithKeys, rows };
  }

  async recordDecision(sessionId: string, dto: RecordDecisionDto, user: AuthUser): Promise<DecisionRecord> {
    const session = await this.getSession(sessionId);
    let chosenOptionId: string | null = null;
    if (dto.chosenOptionKey) {
      const o = await this.options.findOne({ where: { sessionId, optionKey: dto.chosenOptionKey } });
      if (!o) throw new NotFoundException(`Không tìm thấy phương án ${dto.chosenOptionKey}`);
      chosenOptionId = o.id;
    }
    const rec = await this.records.save(
      this.records.create({
        sessionId,
        chosenOptionId,
        rationale: dto.rationale ?? null,
        recordedBy: this.uid(user),
        recordedAt: new Date(),
        createdBy: this.uid(user),
        updatedBy: this.uid(user),
      }),
    );
    session.status = DecisionSessionStatus.RECORDED;
    session.updatedBy = this.uid(user);
    await this.sessions.save(session);
    return rec;
  }

  async getSessionDetail(id: string, user?: AuthUser) {
    const session = await this.getSession(id);
    assertReadScope(undefined, ((session.scopeJson as Record<string, unknown>)?.organizationId as string) ?? null, user);
    const [opts, crits, scoreRows, recs] = await Promise.all([
      this.options.find({ where: { sessionId: id }, order: { optionKey: 'ASC' } }),
      this.criteria.find({ where: { sessionId: id }, order: { criterionKey: 'ASC' } }),
      this.scores.find({ where: { sessionId: id } }),
      this.records.find({ where: { sessionId: id }, order: { recordedAt: 'DESC' } }),
    ]);
    return { session, options: opts, criteria: crits, scores: scoreRows, records: recs };
  }

  // ================= command-overview & map =================
  // Tổng quan chỉ huy: mỗi KPI ACTIVE lấy metric mới nhất (có lineage) + freshness sống; chưa có metric → resolve
  // sống (vẫn có lineage). KHÔNG query DB sống ngoài snapshot chuẩn ⇒ mọi KPI truy vết được (AC-15/TC-015).
  async commandOverview(user: AuthUser, scopeJson?: Record<string, unknown>) {
    const kpis = await this.kpis.find({ where: { status: KpiDefinitionStatus.ACTIVE }, order: { kpiCode: 'ASC' } });
    const scope = scopeJson ? this.toSemanticScope(scopeJson) : this.userSemanticScope(user);
    const items = [];
    for (const kpi of kpis) {
      const latest = (await this.metrics.find({ where: { kpiDefinitionId: kpi.id }, order: { computedAt: 'DESC' }, take: 1 }))[0] ?? null;
      const cur = await resolveSemantic(this.semCtx(), kpi.semanticRef, scope);
      if (latest) {
        items.push({
          kpiCode: kpi.kpiCode,
          name: kpi.name,
          semantic: kpi.semanticRef,
          unit: kpi.unit,
          value: latest.value !== null ? Number(latest.value) : null,
          asOfTime: latest.asOfTime,
          freshness: resolveFreshness(latest.sourceVersion, cur.sourceVersion),
          persisted: true,
          metricInstanceId: latest.id,
          lineage: latest.lineageJson,
        });
      } else {
        items.push({
          kpiCode: kpi.kpiCode,
          name: kpi.name,
          semantic: kpi.semanticRef,
          unit: kpi.unit,
          value: cur.value,
          asOfTime: cur.sourceAsOf,
          freshness: cur.sourceVersion ? FreshnessStatus.FRESH : FreshnessStatus.NO_SOURCE,
          persisted: false,
          lineage: cur.lineage,
        });
      }
    }
    return { generatedAt: new Date().toISOString(), scope, kpis: items };
  }

  // Bản đồ vật chất theo phân quyền vị trí (SYS-BR-08): HC theo đơn vị, chỉ trong phạm vi data-scope của người dùng.
  async mapMaterials(user: AuthUser) {
    const scope = this.userSemanticScope(user);
    const snap = (await this.materielSnapshots.find({ order: { asOfTime: 'DESC' }, take: 1 }))[0] ?? null;
    if (!snap) return { generatedAt: new Date().toISOString(), scope, snapshot: null, items: [] };
    const lines = await this.materielLines.find({ where: { snapshotId: snap.id } });
    const byOrg = new Map<string, number>();
    for (const l of lines) {
      const org = l.organizationId ?? 'UNASSIGNED';
      if (scope.organizationId && org !== scope.organizationId) continue; // chỉ thấy phạm vi (TC-010)
      byOrg.set(org, (byOrg.get(org) ?? 0) + (toNum(l.quantityOnHand) ?? 0));
    }
    return {
      generatedAt: new Date().toISOString(),
      scope,
      snapshot: { id: snap.id, code: snap.snapshotCode, asOfTime: snap.asOfTime, checksum: snap.checksum },
      items: [...byOrg.entries()].map(([organizationId, hc]) => ({ organizationId, hc })),
    };
  }
}
