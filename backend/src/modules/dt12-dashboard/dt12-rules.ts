import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { sha256Hex } from '../../common/crypto/stable-hash';
import {
  ALERT_TRANSITIONS,
  AlertInstanceStatus,
  AlertSeverity,
  DT12_ENGINE_VERSION,
  FreshnessStatus,
  ThresholdDirection,
} from './dt12.enums';

// DT-12 — quy tắc nghiệp vụ THUẦN (không side-effect). metric_hash tất định, freshness, đánh giá ngưỡng,
// chuyển trạng thái cảnh báo, chấm điểm quyết định. Mọi metric có lineage; KHÔNG tự chế số (AC-15/SYS-BR-06).

const EPS = 1e-9;

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface LineageRef {
  sourceType: string;
  snapshotId?: string | null;
  runId?: string | null;
  version?: string | number | null;
  checksum?: string | null;
  [k: string]: unknown;
}

export interface MetricPayload {
  engineVersion: string;
  kpiCode: string;
  semantic: string;
  scope: Record<string, unknown>;
  asOf: string; // ISO — mốc as_of_time (tham gia hash để phân biệt mốc thời gian)
  value: number | null;
  lineage: LineageRef[];
  // computed_at KHÔNG tham gia hash (cùng nguồn + mốc ⇒ cùng metric_hash — tái lập).
}

// metric_hash: chốt NỘI DUNG metric (engine + kpi + semantic + scope + asOf + value + lineage), bỏ computed_at.
export function computeMetricHash(payload: MetricPayload): string {
  return sha256Hex({
    engineVersion: payload.engineVersion,
    kpiCode: payload.kpiCode,
    semantic: payload.semantic,
    scope: payload.scope,
    asOf: payload.asOf,
    value: payload.value,
    lineage: payload.lineage,
  });
}

// Freshness tất định: metric tính từ source_version; nếu nguồn hiện có phiên bản MỚI HƠN ⇒ STALE.
// Không có nguồn nào ⇒ NO_SOURCE (khác 0). So sánh chuỗi version (đủ cho version/checksum ổn định).
export function resolveFreshness(
  metricSourceVersion: string | null | undefined,
  latestSourceVersion: string | null | undefined,
): FreshnessStatus {
  if (!latestSourceVersion) return FreshnessStatus.NO_SOURCE;
  if (!metricSourceVersion) return FreshnessStatus.STALE;
  return metricSourceVersion === latestSourceVersion ? FreshnessStatus.FRESH : FreshnessStatus.STALE;
}

export interface ThresholdLike {
  warnLevel: number | null;
  criticalLevel: number | null;
  direction: ThresholdDirection;
}

// Đánh giá giá trị KPI so với ngưỡng → severity. HIGHER_WORSE: value ≥ level là xấu; LOWER_WORSE: value ≤ level xấu.
// value null (NO_DATA) ⇒ không sinh severity (trả null). critical thắng warn.
export function evaluateThreshold(value: number | null, t: ThresholdLike): AlertSeverity | null {
  if (value === null) return null;
  const worseThan = (level: number | null): boolean => {
    if (level === null || level === undefined) return false;
    return t.direction === ThresholdDirection.HIGHER_WORSE ? value >= level - EPS : value <= level + EPS;
  };
  if (worseThan(t.criticalLevel)) return AlertSeverity.CRITICAL;
  if (worseThan(t.warnLevel)) return AlertSeverity.WARN;
  return null;
}

// Chuyển trạng thái cảnh báo OPEN→ACK→RESOLVED. Sửa bản RESOLVED ⇒ LOCKED_IMMUTABLE.
export function assertAlertTransition(cur: AlertInstanceStatus, next: AlertInstanceStatus): void {
  const allowed = ALERT_TRANSITIONS[cur] ?? [];
  if (!allowed.includes(next)) {
    if (cur === AlertInstanceStatus.RESOLVED) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, `Cảnh báo đã RESOLVED, không thể chuyển ${next}`);
    }
    throw new BusinessException(BusinessError.STALE_WRITE, `Chuyển trạng thái cảnh báo không hợp lệ: ${cur} → ${next}`);
  }
}

// SLA: hạn xử lý = as_of + sla_hours (giờ).
export function slaDueAt(asOf: Date, slaHours: number): Date {
  return new Date(asOf.getTime() + Math.max(0, slaHours) * 3600 * 1000);
}

// ---------------- Chấm điểm hỗ trợ quyết định (§IX) ----------------
export interface ScoreInput {
  optionId: string;
  criterionId: string;
  rawValue: number | null;
}
export interface CriterionInput {
  criterionId: string;
  weight: number;
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER';
}
export interface ScoredRow {
  optionId: string;
  criterionId: string;
  rawValue: number | null;
  normalized: number | null;
  weighted: number | null;
}

// Chuẩn hóa min-max theo từng tiêu chí (0..1). LOWER_BETTER đảo dấu. Sau đó nhân trọng số.
export function scoreOptions(scores: ScoreInput[], criteria: CriterionInput[]): {
  rows: ScoredRow[];
  ranking: Array<{ optionId: string; total: number }>;
} {
  const critById = new Map(criteria.map((c) => [c.criterionId, c]));
  const byCrit = new Map<string, ScoreInput[]>();
  for (const s of scores) {
    const arr = byCrit.get(s.criterionId) ?? [];
    arr.push(s);
    byCrit.set(s.criterionId, arr);
  }
  const rows: ScoredRow[] = [];
  for (const s of scores) {
    const crit = critById.get(s.criterionId);
    const group = byCrit.get(s.criterionId) ?? [];
    const vals = group.map((g) => g.rawValue).filter((v): v is number => v !== null);
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    let normalized: number | null = null;
    if (s.rawValue !== null) {
      normalized = max - min < EPS ? 1 : (s.rawValue - min) / (max - min);
      if (crit?.direction === 'LOWER_BETTER') normalized = 1 - normalized;
    }
    const weight = crit?.weight ?? 1;
    const weighted = normalized === null ? null : normalized * weight;
    rows.push({ optionId: s.optionId, criterionId: s.criterionId, rawValue: s.rawValue, normalized, weighted });
  }
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (r.weighted !== null) totals.set(r.optionId, (totals.get(r.optionId) ?? 0) + r.weighted);
  }
  const ranking = [...totals.entries()]
    .map(([optionId, total]) => ({ optionId, total }))
    .sort((a, b) => b.total - a.total);
  return { rows, ranking };
}

export { DT12_ENGINE_VERSION };
