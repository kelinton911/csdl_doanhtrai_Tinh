import { Repository } from 'typeorm';
import { MaterielSnapshot } from '../dt04-materiel/entities/materiel-snapshot.entity';
import { MaterielSnapshotLine } from '../dt04-materiel/entities/materiel-snapshot-line.entity';
import { AllocationHold } from '../dt06-allocation/entities/allocation-hold.entity';
import { AllocationSnapshot, AllocationSnapshotLine } from '../dt06-allocation/entities/allocation-snapshot.entity';
import { CalculationRun } from '../dt08-calculation/entities/calculation-run.entity';
import { MaterialCalculation } from '../dt08-calculation/entities/material-calculation.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from '../dt09-balance/entities/balance-snapshot.entity';
import { OfficialSnapshot, OfficialSnapshotLine } from '../dt10-inventory-count/entities/official-snapshot.entity';
import { AllocationCategory, HoldStatus, AllocationSemantics } from '../dt06-allocation/alloc-rules';
import { Dt12SourceType, Semantic } from './dt12.enums';
import { LineageRef, toNum } from './dt12-rules';

// DT-12 — adapter semantic. Mỗi semantic đọc SNAPSHOT CHUẨN mới nhất (bất biến) của phân hệ thượng nguồn,
// trả về { value, sourceAsOf, sourceVersion, lineage }. value = null khi KHÔNG có snapshot nguồn (giữ nghĩa
// NO_DATA — KHÔNG quy 0). source_version chốt trạng thái nguồn để suy freshness tất định (AC-15/P10).

export interface SemanticScope {
  organizationId?: string | null;
  areaIds?: string[];
}

export interface SemanticContext {
  materielSnapshots: Repository<MaterielSnapshot>;
  materielLines: Repository<MaterielSnapshotLine>;
  allocationHolds: Repository<AllocationHold>;
  allocationSnapshots: Repository<AllocationSnapshot>;
  allocationSnapshotLines: Repository<AllocationSnapshotLine>;
  calcRuns: Repository<CalculationRun>;
  materialCalcs: Repository<MaterialCalculation>;
  balanceSnapshots: Repository<BalanceSnapshot>;
  balanceLines: Repository<BalanceSnapshotLine>;
  officialSnapshots: Repository<OfficialSnapshot>;
  officialLines: Repository<OfficialSnapshotLine>;
}

export interface SemanticResult {
  semantic: Semantic;
  value: number | null;
  unit?: string | null;
  sourceAsOf: Date | null;
  sourceVersion: string | null;
  lineage: LineageRef[];
}

export interface DrillDownRow {
  materialCatalogId: string;
  organizationId?: string | null;
  value: number | null;
  extra?: Record<string, unknown>;
}

const inOrgScope = (orgId: string | null | undefined, scope: SemanticScope): boolean =>
  !scope.organizationId || orgId === scope.organizationId;

// ---------------- Snapshot mới nhất theo nguồn ----------------
async function latestMateriel(ctx: SemanticContext): Promise<MaterielSnapshot | null> {
  return (await ctx.materielSnapshots.find({ order: { asOfTime: 'DESC' }, take: 1 }))[0] ?? null;
}
async function latestBalance(ctx: SemanticContext): Promise<BalanceSnapshot | null> {
  return (await ctx.balanceSnapshots.find({ order: { approvedAt: 'DESC' }, take: 1 }))[0] ?? null;
}
async function latestRun(ctx: SemanticContext): Promise<CalculationRun | null> {
  return (await ctx.calcRuns.find({ order: { createdAt: 'DESC' }, take: 1 }))[0] ?? null;
}
async function latestAllocationSnapshot(ctx: SemanticContext): Promise<AllocationSnapshot | null> {
  return (await ctx.allocationSnapshots.find({ order: { cutoffTime: 'DESC' }, take: 1 }))[0] ?? null;
}

// ---------------- Từng semantic ----------------
async function resolveHc(ctx: SemanticContext, scope: SemanticScope): Promise<SemanticResult> {
  const snap = await latestMateriel(ctx);
  if (!snap) return empty(Semantic.SEM_HC);
  const lines = await ctx.materielLines.find({ where: { snapshotId: snap.id } });
  const value = lines
    .filter((l) => inOrgScope(l.organizationId, scope))
    .reduce((s, l) => s + (toNum(l.quantityOnHand) ?? 0), 0);
  return {
    semantic: Semantic.SEM_HC,
    value,
    sourceAsOf: snap.asOfTime,
    sourceVersion: `${snap.snapshotCode}:${snap.checksum ?? snap.asOfTime.toISOString()}`,
    lineage: [
      { sourceType: Dt12SourceType.DT04_MATERIEL_SNAPSHOT, snapshotId: snap.id, version: snap.snapshotCode, checksum: snap.checksum, asOf: snap.asOfTime.toISOString() },
    ],
  };
}

async function activeHoldSum(ctx: SemanticContext, scope: SemanticScope, category?: AllocationCategory): Promise<{ sum: number; count: number }> {
  const holds = await ctx.allocationHolds.find({ where: { status: HoldStatus.ACTIVE } });
  const relevant = holds.filter(
    (h) =>
      inOrgScope(h.organizationId, scope) &&
      (category ? h.category === category : h.semantics === AllocationSemantics.EXCLUSIVE),
  );
  return { sum: relevant.reduce((s, h) => s + (toNum(h.quantityReserved) ?? 0), 0), count: relevant.length };
}

async function resolveHcAvailable(ctx: SemanticContext, scope: SemanticScope): Promise<SemanticResult> {
  const hc = await resolveHc(ctx, scope);
  if (hc.value === null) return empty(Semantic.SEM_HC_AVAILABLE);
  const { sum: held, count } = await activeHoldSum(ctx, scope);
  return {
    semantic: Semantic.SEM_HC_AVAILABLE,
    value: hc.value - held, // HC − hold/in-transit (EXCLUSIVE ACTIVE)
    sourceAsOf: hc.sourceAsOf,
    sourceVersion: `${hc.sourceVersion}|holdX:${count}:${held}`,
    lineage: [
      ...hc.lineage,
      { sourceType: Dt12SourceType.DT06_ALLOCATION_HOLD, version: `active:${count}`, note: `held=${held}` },
    ],
  };
}

async function resolveReserveSscd(ctx: SemanticContext, scope: SemanticScope): Promise<SemanticResult> {
  const { sum, count } = await activeHoldSum(ctx, scope, AllocationCategory.SSCD);
  const snap = await latestAllocationSnapshot(ctx);
  // Ưu tiên hold ACTIVE loại SSCĐ (số sống chốt). Nếu không có hold nào và không có snapshot ⇒ NO_DATA.
  if (count === 0 && !snap) return empty(Semantic.SEM_RESERVE_SSCD);
  return {
    semantic: Semantic.SEM_RESERVE_SSCD,
    value: sum,
    sourceAsOf: snap?.cutoffTime ?? null,
    sourceVersion: `sscdHold:${count}:${sum}${snap ? `|snap:${snap.checksum ?? snap.id}` : ''}`,
    lineage: [
      { sourceType: Dt12SourceType.DT06_ALLOCATION_HOLD, version: `sscd:${count}` },
      ...(snap ? [{ sourceType: Dt12SourceType.DT06_ALLOCATION_SNAPSHOT, snapshotId: snap.id, checksum: snap.checksum } as LineageRef] : []),
    ],
  };
}

async function resolveFromRun(ctx: SemanticContext, semantic: Semantic, field: 'pcSscd' | 'nc' | 'supplyRequired'): Promise<SemanticResult> {
  const run = await latestRun(ctx);
  if (!run) return empty(semantic);
  const calcs = await ctx.materialCalcs.find({ where: { runId: run.id } });
  // NO_RULE/CONFLICT/NO_HC_SNAPSHOT → trị null (KHÔNG quy 0). Tổng bỏ qua null.
  const nums = calcs.map((c) => toNum(c[field] as unknown)).filter((n): n is number => n !== null);
  const value = calcs.length === 0 ? null : nums.reduce((s, n) => s + n, 0);
  return {
    semantic,
    value,
    sourceAsOf: run.finishedAt ?? run.createdAt ?? null,
    sourceVersion: run.outputHash ?? run.id,
    lineage: [{ sourceType: Dt12SourceType.DT08_CALCULATION_RUN, runId: run.id, version: run.outputHash ?? run.runNo, checksum: run.outputHash }],
  };
}

async function resolveFromBalance(ctx: SemanticContext, semantic: Semantic, field: 'supplyRequired' | 'gapQty'): Promise<SemanticResult> {
  const snap = await latestBalance(ctx);
  if (!snap) {
    // SUPPLY_REQUIRED có fallback DT-08; GAP không có nguồn khác ⇒ NO_DATA.
    if (semantic === Semantic.SEM_SUPPLY_REQUIRED) return resolveFromRun(ctx, semantic, 'supplyRequired');
    return empty(semantic);
  }
  const lines = await ctx.balanceLines.find({ where: { snapshotId: snap.id } });
  const value = lines.reduce((s, l) => s + (toNum(l[field] as unknown) ?? 0), 0);
  return {
    semantic,
    value,
    sourceAsOf: snap.approvedAt,
    sourceVersion: snap.checksum,
    lineage: [{ sourceType: Dt12SourceType.DT09_BALANCE_SNAPSHOT, snapshotId: snap.id, version: snap.planRevisionNo, checksum: snap.checksum }],
  };
}

function empty(semantic: Semantic): SemanticResult {
  return { semantic, value: null, sourceAsOf: null, sourceVersion: null, lineage: [] };
}

// Điểm vào: resolve 1 semantic theo phạm vi (as_of hiện chốt bằng snapshot mới nhất — DT-12 đọc bản chuẩn gần nhất).
export async function resolveSemantic(ctx: SemanticContext, semantic: Semantic, scope: SemanticScope): Promise<SemanticResult> {
  switch (semantic) {
    case Semantic.SEM_HC:
      return resolveHc(ctx, scope);
    case Semantic.SEM_HC_AVAILABLE:
      return resolveHcAvailable(ctx, scope);
    case Semantic.SEM_RESERVE_SSCD:
      return resolveReserveSscd(ctx, scope);
    case Semantic.SEM_PC_SCD:
      return resolveFromRun(ctx, semantic, 'pcSscd');
    case Semantic.SEM_NC:
      return resolveFromRun(ctx, semantic, 'nc');
    case Semantic.SEM_SUPPLY_REQUIRED:
      return resolveFromBalance(ctx, semantic, 'supplyRequired');
    case Semantic.SEM_GAP:
      return resolveFromBalance(ctx, semantic, 'gapQty');
    default:
      return empty(semantic);
  }
}

// Drill-down: trả các DÒNG snapshot nguồn của semantic để kiểm chứng tổng (TC-001). Tổng dòng = value metric.
export async function drillDownSemantic(ctx: SemanticContext, semantic: Semantic, scope: SemanticScope): Promise<{ sourceType: string; rows: DrillDownRow[] }> {
  switch (semantic) {
    case Semantic.SEM_HC:
    case Semantic.SEM_HC_AVAILABLE: {
      const snap = await latestMateriel(ctx);
      if (!snap) return { sourceType: Dt12SourceType.DT04_MATERIEL_SNAPSHOT, rows: [] };
      const lines = (await ctx.materielLines.find({ where: { snapshotId: snap.id } })).filter((l) => inOrgScope(l.organizationId, scope));
      return {
        sourceType: Dt12SourceType.DT04_MATERIEL_SNAPSHOT,
        rows: lines.map((l) => ({ materialCatalogId: l.materialCatalogId, organizationId: l.organizationId, value: toNum(l.quantityOnHand) })),
      };
    }
    case Semantic.SEM_PC_SCD:
    case Semantic.SEM_NC: {
      const run = await latestRun(ctx);
      if (!run) return { sourceType: Dt12SourceType.DT08_CALCULATION_RUN, rows: [] };
      const calcs = await ctx.materialCalcs.find({ where: { runId: run.id } });
      const field = semantic === Semantic.SEM_NC ? 'nc' : 'pcSscd';
      return {
        sourceType: Dt12SourceType.DT08_CALCULATION_RUN,
        rows: calcs.map((c) => ({ materialCatalogId: c.materialCatalogId, value: toNum(c[field as 'nc' | 'pcSscd'] as unknown), extra: { ruleStatus: c.ruleStatus, hcStatus: c.hcStatus } })),
      };
    }
    case Semantic.SEM_SUPPLY_REQUIRED:
    case Semantic.SEM_GAP: {
      const snap = await latestBalance(ctx);
      if (!snap) return { sourceType: Dt12SourceType.DT09_BALANCE_SNAPSHOT, rows: [] };
      const lines = await ctx.balanceLines.find({ where: { snapshotId: snap.id } });
      const field = semantic === Semantic.SEM_GAP ? 'gapQty' : 'supplyRequired';
      return {
        sourceType: Dt12SourceType.DT09_BALANCE_SNAPSHOT,
        rows: lines.map((l) => ({ materialCatalogId: l.materialCatalogId, value: toNum(l[field as 'gapQty' | 'supplyRequired'] as unknown) })),
      };
    }
    case Semantic.SEM_RESERVE_SSCD: {
      const holds = (await ctx.allocationHolds.find({ where: { status: HoldStatus.ACTIVE } })).filter(
        (h) => h.category === AllocationCategory.SSCD && inOrgScope(h.organizationId, scope),
      );
      return {
        sourceType: Dt12SourceType.DT06_ALLOCATION_HOLD,
        rows: holds.map((h) => ({ materialCatalogId: h.materialCatalogId, organizationId: h.organizationId, value: toNum(h.quantityReserved) })),
      };
    }
    default:
      return { sourceType: 'UNKNOWN', rows: [] };
  }
}
