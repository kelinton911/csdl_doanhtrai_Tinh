import { DataSource, Repository } from 'typeorm';
import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { sha256Hex } from '../../common/crypto/stable-hash';
import { CellState, DatasetSourceType } from './dt11.enums';
import { cellStateOf, evalFormula, toNum, type DatasetRow } from './report-rules';
import { OfficialSnapshot, OfficialSnapshotLine } from '../dt10-inventory-count/entities/official-snapshot.entity';
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from '../dt09-balance/entities/balance-snapshot.entity';
import { CalculationRun } from '../dt08-calculation/entities/calculation-run.entity';
import { MaterialCalculation } from '../dt08-calculation/entities/material-calculation.entity';
import { fetchLandTree, type LandFormMeta } from '../reporting/land-forms';

// DT-11 — Adapter nguồn dataset. Mỗi loại nguồn đọc SNAPSHOT CHUẨN (bất biến) của phân hệ thượng nguồn
// → chuẩn hóa thành rawRows { key, values, refs } + sourceTotals + upstreamHash (checksum/hash thượng nguồn).
// KHÔNG đọc số sống (SYS-BR-06). NO_RULE/thiếu HC → giá trị null (giữ NO_DATA, không quy 0).

export interface RawRow {
  key: string;
  values: Record<string, number | string | null>;
  refs: Record<string, unknown>;
}
export interface SourceFetchResult {
  rawRows: RawRow[];
  sourceTotals: Record<string, number>;
  upstreamHash: string | null;
  availablePaths: string[]; // các source_path canonical mà nguồn cấp (để kiểm data-contract kể cả khi rỗng)
  refBase: Record<string, unknown>; // thông tin snapshot để nhúng lineage
}

export interface FieldDef {
  fieldKey: string;
  sourcePath: string;
  dataType: string; // number | value | quality_total | string
  header?: string | null;
  orderNo: number;
}
export interface FormulaDef {
  targetField: string;
  formulaExpr: string;
  orderNo: number;
}

export interface SourceContext {
  officialSnapshots: Repository<OfficialSnapshot>;
  officialLines: Repository<OfficialSnapshotLine>;
  materielSnapshots: Repository<MaterielSnapshot>;
  materielLines: Repository<MaterielSnapshotLine>;
  balanceSnapshots: Repository<BalanceSnapshot>;
  balanceLines: Repository<BalanceSnapshotLine>;
  calcRuns: Repository<CalculationRun>;
  materialCalcs: Repository<MaterialCalculation>;
  dataSource: DataSource;
}

const NUMERIC_TYPES = new Set(['number', 'value', 'quality_total']);

// ---------------- Đọc nguồn theo source_type ----------------
export async function fetchSource(
  ctx: SourceContext,
  sourceType: DatasetSourceType,
  ref: Record<string, unknown>,
): Promise<SourceFetchResult> {
  switch (sourceType) {
    case DatasetSourceType.DT10_OFFICIAL_SNAPSHOT:
      return fetchDt10(ctx, ref);
    case DatasetSourceType.DT04_MATERIEL_SNAPSHOT:
      return fetchDt04(ctx, ref);
    case DatasetSourceType.DT09_BALANCE_SNAPSHOT:
      return fetchDt09(ctx, ref);
    case DatasetSourceType.DT08_CALCULATION_RUN:
      return fetchDt08(ctx, ref);
    case DatasetSourceType.LAND_FORMS:
      return fetchLand(ctx, ref);
    default:
      throw new BusinessException(BusinessError.DATA_CONTRACT_MISMATCH, `Loại nguồn không hỗ trợ: ${sourceType}`);
  }
}

const DT10_PATHS = ['materialCatalogId', 'lotId', 'total', 'officialQty', 'c1', 'c2', 'c3', 'c4', 'c5', 'value'];
async function fetchDt10(ctx: SourceContext, ref: Record<string, unknown>): Promise<SourceFetchResult> {
  const campaignId = ref.campaignId as string | undefined;
  const snapshotId = ref.snapshotId as string | undefined;
  let snap: OfficialSnapshot | null = null;
  if (snapshotId) snap = await ctx.officialSnapshots.findOne({ where: { id: snapshotId } });
  else if (campaignId)
    snap = (await ctx.officialSnapshots.find({ where: { campaignId }, order: { version: 'DESC' }, take: 1 }))[0] ?? null;
  if (!snap) throw new BusinessException(BusinessError.NO_OFFICIAL_SNAPSHOT, 'Chưa có official_snapshot cho kỳ kiểm kê');
  const lines = await ctx.officialLines.find({ where: { snapshotId: snap.id } });
  const rawRows: RawRow[] = lines.map((l) => {
    const total = toNum(l.officialQty) ?? 0;
    return {
      key: `${l.materialCatalogId}${l.lotId ? ':' + l.lotId : ''}`,
      values: {
        materialCatalogId: l.materialCatalogId,
        lotId: l.lotId,
        total,
        officialQty: total,
        c1: toNum(l.grade1) ?? 0,
        c2: toNum(l.grade2) ?? 0,
        c3: toNum(l.grade3) ?? 0,
        c4: toNum(l.grade4) ?? 0,
        c5: toNum(l.grade5) ?? 0,
        value: toNum(l.value),
      },
      refs: { materialCatalogId: l.materialCatalogId, lotId: l.lotId, snapshotLineId: l.id },
    };
  });
  const sumTotal = rawRows.reduce((s, r) => s + (toNum(r.values.total) ?? 0), 0);
  return {
    rawRows,
    sourceTotals: { total: sumTotal },
    upstreamHash: snap.checksum,
    availablePaths: DT10_PATHS,
    refBase: { sourceType: DatasetSourceType.DT10_OFFICIAL_SNAPSHOT, campaignId: snap.campaignId, snapshotId: snap.id, snapshotVersion: snap.version, datasetHash: snap.checksum },
  };
}

const DT04_PATHS = ['materialCatalogId', 'lotId', 'total', 'quantityOnHand', 'c1', 'c2', 'c3', 'c4', 'c5', 'value'];
async function fetchDt04(ctx: SourceContext, ref: Record<string, unknown>): Promise<SourceFetchResult> {
  const snapshotId = ref.snapshotId as string | undefined;
  const snapshotCode = ref.snapshotCode as string | undefined;
  let snap: MaterielSnapshot | null = null;
  if (snapshotId) snap = await ctx.materielSnapshots.findOne({ where: { id: snapshotId } });
  else if (snapshotCode) snap = await ctx.materielSnapshots.findOne({ where: { snapshotCode } });
  if (!snap) throw new BusinessException(BusinessError.NO_OFFICIAL_SNAPSHOT, 'Không tìm thấy materiel_snapshot');
  const lines = await ctx.materielLines.find({ where: { snapshotId: snap.id } });
  const rawRows: RawRow[] = lines.map((l) => {
    const total = toNum(l.quantityOnHand) ?? 0;
    return {
      key: `${l.materialCatalogId}${l.lotId ? ':' + l.lotId : ''}`,
      values: {
        materialCatalogId: l.materialCatalogId,
        lotId: l.lotId,
        total,
        quantityOnHand: total,
        c1: toNum(l.grade1) ?? 0,
        c2: toNum(l.grade2) ?? 0,
        c3: toNum(l.grade3) ?? 0,
        c4: toNum(l.grade4) ?? 0,
        c5: toNum(l.grade5) ?? 0,
        value: toNum(l.value),
      },
      refs: { materialCatalogId: l.materialCatalogId, lotId: l.lotId, snapshotLineId: l.id },
    };
  });
  const sumTotal = rawRows.reduce((s, r) => s + (toNum(r.values.total) ?? 0), 0);
  return {
    rawRows,
    sourceTotals: { total: sumTotal },
    upstreamHash: snap.checksum,
    availablePaths: DT04_PATHS,
    refBase: { sourceType: DatasetSourceType.DT04_MATERIEL_SNAPSHOT, snapshotId: snap.id, snapshotCode: snap.snapshotCode, asOfTime: snap.asOfTime },
  };
}

const DT09_PATHS = ['materialCatalogId', 'total', 'supplyRequired', 'plannedSource', 'gap'];
async function fetchDt09(ctx: SourceContext, ref: Record<string, unknown>): Promise<SourceFetchResult> {
  const snapshotId = ref.snapshotId as string | undefined;
  const planId = ref.planId as string | undefined;
  let snap: BalanceSnapshot | null = null;
  if (snapshotId) snap = await ctx.balanceSnapshots.findOne({ where: { id: snapshotId } });
  else if (planId)
    snap = (await ctx.balanceSnapshots.find({ where: { planId }, order: { planRevisionNo: 'DESC' }, take: 1 }))[0] ?? null;
  if (!snap) throw new BusinessException(BusinessError.NO_OFFICIAL_SNAPSHOT, 'Không tìm thấy balance_snapshot đã phê duyệt');
  const lines = await ctx.balanceLines.find({ where: { snapshotId: snap.id } });
  const rawRows: RawRow[] = lines.map((l) => {
    const sr = toNum(l.supplyRequired) ?? 0;
    return {
      key: l.materialCatalogId,
      values: {
        materialCatalogId: l.materialCatalogId,
        total: sr,
        supplyRequired: sr,
        plannedSource: toNum(l.plannedSourceQty) ?? 0,
        gap: toNum(l.gapQty) ?? 0,
      },
      refs: { materialCatalogId: l.materialCatalogId, snapshotLineId: l.id },
    };
  });
  const sumTotal = rawRows.reduce((s, r) => s + (toNum(r.values.total) ?? 0), 0);
  return {
    rawRows,
    sourceTotals: { total: sumTotal },
    upstreamHash: sha256Hex({ checksum: snap.checksum, fingerprint: snap.sourceFingerprint }),
    availablePaths: DT09_PATHS,
    refBase: { sourceType: DatasetSourceType.DT09_BALANCE_SNAPSHOT, planId: snap.planId, snapshotId: snap.id, planRevisionNo: snap.planRevisionNo, sourceFingerprint: snap.sourceFingerprint },
  };
}

const DT08_PATHS = ['materialCatalogId', 'total', 'nc', 'supplyRequired', 'tt', 'pcSscd', 'hc'];
async function fetchDt08(ctx: SourceContext, ref: Record<string, unknown>): Promise<SourceFetchResult> {
  const runId = ref.runId as string | undefined;
  if (!runId) throw new BusinessException(BusinessError.DATA_CONTRACT_MISMATCH, 'Thiếu runId cho nguồn DT-08');
  const run = await ctx.calcRuns.findOne({ where: { id: runId } });
  if (!run) throw new BusinessException(BusinessError.NO_OFFICIAL_SNAPSHOT, 'Không tìm thấy calculation_run');
  const calcs = await ctx.materialCalcs.find({ where: { runId } });
  // NO_RULE/CONFLICT/NO_HC_SNAPSHOT → giá trị null (KHÔNG quy 0 — BR-DT08-008 → NO_DATA ở DT-11).
  const rawRows: RawRow[] = calcs.map((c) => ({
    key: c.materialCatalogId,
    values: {
      materialCatalogId: c.materialCatalogId,
      total: toNum(c.supplyRequired),
      nc: toNum(c.nc),
      supplyRequired: toNum(c.supplyRequired),
      tt: toNum(c.tt),
      pcSscd: toNum(c.pcSscd),
      hc: toNum(c.hc),
    },
    refs: { materialCatalogId: c.materialCatalogId, ruleStatus: c.ruleStatus, hcStatus: c.hcStatus },
  }));
  const sumTotal = rawRows.reduce((s, r) => s + (toNum(r.values.total) ?? 0), 0);
  return {
    rawRows,
    sourceTotals: { total: sumTotal },
    upstreamHash: run.outputHash,
    availablePaths: DT08_PATHS,
    refBase: { sourceType: DatasetSourceType.DT08_CALCULATION_RUN, runId: run.id, scenarioId: run.scenarioId, outputHash: run.outputHash },
  };
}

const LAND_PATHS = ['blockCode', 'name', 'total', 'areaNow', 'areaPrev', 'incArea', 'decArea', 'areaDefense', 'areaEconomic', 'areaFamily'];
async function fetchLand(ctx: SourceContext, ref: Record<string, unknown>): Promise<SourceFetchResult> {
  // Tái dùng fetchLandTree của module reporting (đọc land_parcels + snapshot kỳ trước — DT-02).
  const meta: LandFormMeta = {
    provinceName: String(ref.provinceName ?? ''),
    quanKhu: String(ref.quanKhu ?? ''),
    periodCurrent: String(ref.periodCurrent ?? ''),
    periodPrevious: String(ref.periodPrevious ?? ''),
    dataSource: String(ref.dataSource ?? ''),
    watermark: '',
  };
  const tree = await fetchLandTree(ctx.dataSource, meta);
  const rawRows: RawRow[] = tree.blocks.flatMap((b) =>
    b.leaves.map((lf) => ({
      key: lf.code,
      values: {
        blockCode: b.code,
        name: lf.name,
        total: lf.areaNow,
        areaNow: lf.areaNow,
        areaPrev: lf.areaPrev,
        incArea: lf.incArea,
        decArea: lf.decArea,
        areaDefense: lf.areaDefense,
        areaEconomic: lf.areaEconomic,
        areaFamily: lf.areaFamily,
      },
      refs: { parcelCode: lf.code, blockCode: b.code },
    })),
  );
  return {
    rawRows,
    sourceTotals: { total: tree.grand.areaNow },
    upstreamHash: sha256Hex({ grand: tree.grand, count: rawRows.length, dataSource: meta.dataSource, period: meta.periodCurrent }),
    availablePaths: LAND_PATHS,
    refBase: { sourceType: DatasetSourceType.LAND_FORMS, dataSource: meta.dataSource, periodCurrent: meta.periodCurrent, periodPrevious: meta.periodPrevious },
  };
}

// ---------------- Ánh xạ field/filter/formula → DatasetRow ----------------
// data-contract: mọi field không phải formula-target phải có source_path ∈ availablePaths, else DATA_CONTRACT_MISMATCH.
export function buildDatasetRows(
  src: SourceFetchResult,
  fields: FieldDef[],
  formulas: FormulaDef[],
): DatasetRow[] {
  const formulaTargets = new Set(formulas.map((f) => f.targetField));
  const available = new Set(src.availablePaths);
  const missing = fields
    .filter((f) => !formulaTargets.has(f.fieldKey))
    .filter((f) => !available.has(f.sourcePath))
    .map((f) => f.sourcePath);
  if (missing.length) {
    throw new BusinessException(
      BusinessError.DATA_CONTRACT_MISMATCH,
      `Nguồn không cấp các trường: ${[...new Set(missing)].join(', ')}`,
    );
  }
  const orderedFormulas = [...formulas].sort((a, b) => a.orderNo - b.orderNo);
  return src.rawRows.map((raw) => {
    const cells: DatasetRow['cells'] = {};
    const numericScope: Record<string, number | null> = {};
    // 1) field cơ sở (không phải formula target)
    for (const f of fields) {
      if (formulaTargets.has(f.fieldKey)) continue;
      const rawVal = raw.values[f.sourcePath];
      if (NUMERIC_TYPES.has(f.dataType)) {
        const n = rawVal === undefined ? null : toNum(rawVal);
        cells[f.fieldKey] = { value: n, state: cellStateOf(n) };
        numericScope[f.fieldKey] = n;
      } else {
        const v = rawVal === undefined || rawVal === null ? null : String(rawVal);
        cells[f.fieldKey] = { value: v, state: v === null ? CellState.NO_DATA : CellState.VALUE };
      }
    }
    // 2) field công thức
    for (const fm of orderedFormulas) {
      const n = evalFormula(fm.formulaExpr, numericScope);
      cells[fm.targetField] = { value: n, state: cellStateOf(n) };
      numericScope[fm.targetField] = n;
    }
    return { key: raw.key, cells, refs: raw.refs };
  });
}
