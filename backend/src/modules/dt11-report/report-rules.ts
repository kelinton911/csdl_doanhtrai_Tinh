import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { sha256Hex } from '../../common/crypto/stable-hash';
import {
  CellState,
  REPORT_ENGINE_VERSION,
  REPORT_TRANSITIONS,
  ReportInstanceStatus,
  SubmissionStatus,
  ValidationCheckType,
  ValidationStatus,
} from './dt11.enums';

// DT-11 — quy tắc nghiệp vụ THUẦN (không side-effect). Hash tất định, validate, transition, rollup.
// Mọi thao tác có lineage; KHÔNG tạo số riêng (SYS-BR-06). Phân biệt NO_DATA ≠ ZERO ≠ MISSING_SUBMISSION.

const EPS = 1e-6;

export interface DatasetCell {
  value: number | string | null;
  state: CellState;
}
export interface DatasetRow {
  key: string; // rowKey duy nhất trong dataset (vd materialCatalogId[:lotId])
  cells: Record<string, DatasetCell>;
  refs?: Record<string, unknown>; // materialCatalogId, lotId, snapshot refs…
}
export interface DatasetPayload {
  engineVersion: string;
  formCode: string;
  generatedAt?: string; // KHÔNG tham gia hash (để cùng nguồn ⇒ cùng dataset_hash — BR-DT11-006)
  sourceTotals: Record<string, number>;
  rows: DatasetRow[];
}
export interface ValidationResult {
  checkType: ValidationCheckType;
  status: ValidationStatus;
  message: string;
  details: Record<string, unknown>;
}

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Trạng thái ô: null nguồn ⇒ NO_DATA; 0 ⇒ ZERO; còn lại ⇒ VALUE. (MISSING_SUBMISSION do rollup gán.)
export function cellStateOf(value: number | null): CellState {
  if (value === null) return CellState.NO_DATA;
  if (Math.abs(value) < EPS) return CellState.ZERO;
  return CellState.VALUE;
}

// dataset_hash: chỉ chốt NỘI DUNG (engine + form + tổng nguồn + rows), bỏ generatedAt.
export function computeDatasetHash(payload: DatasetPayload): string {
  return sha256Hex({
    engineVersion: payload.engineVersion,
    formCode: payload.formCode,
    sourceTotals: payload.sourceTotals,
    rows: payload.rows,
  });
}

// source_fingerprint: truy vết nguồn = hash(sourceType + định danh + hash/checksum thượng nguồn).
export function computeSourceFingerprint(
  sourceRef: Record<string, unknown>,
  upstreamHash: string | null,
): string {
  return sha256Hex({ sourceRef, upstreamHash: upstreamHash ?? null, engineVersion: REPORT_ENGINE_VERSION });
}

// Chuyển tiếp trạng thái báo cáo. Sửa bản đã ISSUED ⇒ LOCKED_IMMUTABLE.
export function assertReportTransition(cur: ReportInstanceStatus, next: ReportInstanceStatus): void {
  const allowed = REPORT_TRANSITIONS[cur] ?? [];
  if (!allowed.includes(next)) {
    if (cur === ReportInstanceStatus.ISSUED || cur === ReportInstanceStatus.SUPERSEDED) {
      throw new BusinessException(BusinessError.LOCKED_IMMUTABLE, `Báo cáo đã ${cur}, không thể chuyển sang ${next}`);
    }
    throw new BusinessException(BusinessError.STALE_WRITE, `Chuyển trạng thái không hợp lệ: ${cur} → ${next}`);
  }
}

// Reconciliation: Σ giá trị trường tổng trong dataset khớp tổng nguồn (bỏ NO_DATA — không quy 0).
export function validateReconciliation(payload: DatasetPayload, totalField = 'total'): ValidationResult {
  const expected = payload.sourceTotals?.[totalField];
  let sum = 0;
  for (const r of payload.rows) {
    const c = r.cells[totalField];
    if (!c || c.state === CellState.NO_DATA) continue;
    const n = toNum(c.value);
    if (n !== null) sum += n;
  }
  if (expected === undefined || expected === null) {
    return {
      checkType: ValidationCheckType.RECONCILIATION,
      status: ValidationStatus.WARN,
      message: `Không có tổng nguồn cho trường "${totalField}" để đối chiếu`,
      details: { totalField, datasetSum: sum },
    };
  }
  const diff = sum - expected;
  const ok = Math.abs(diff) < EPS;
  return {
    checkType: ValidationCheckType.RECONCILIATION,
    status: ok ? ValidationStatus.PASS : ValidationStatus.FAIL,
    message: ok
      ? `Khớp: Σ dataset = tổng nguồn = ${expected}`
      : `Lệch reconciliation: Σ dataset ${sum} ≠ tổng nguồn ${expected} (Δ=${diff})`,
    details: { totalField, datasetSum: sum, sourceTotal: expected, diff },
  };
}

// Quality total: Σ cấp chất lượng c1..c5 = tổng số (BR-DT11-007). Bỏ dòng không có trường chất lượng.
export function validateQualityTotal(
  payload: DatasetPayload,
  gradeFields = ['c1', 'c2', 'c3', 'c4', 'c5'],
  totalField = 'total',
): ValidationResult {
  const offenders: Array<{ key: string; sumGrades: number; total: number }> = [];
  let checked = 0;
  for (const r of payload.rows) {
    const hasGrades = gradeFields.every((g) => r.cells[g] !== undefined);
    const tot = r.cells[totalField];
    if (!hasGrades || !tot) continue;
    checked++;
    const sumGrades = gradeFields.reduce((s, g) => s + (toNum(r.cells[g].value) ?? 0), 0);
    const total = toNum(tot.value) ?? 0;
    if (Math.abs(sumGrades - total) > EPS) offenders.push({ key: r.key, sumGrades, total });
  }
  const ok = offenders.length === 0;
  return {
    checkType: ValidationCheckType.QUALITY_TOTAL,
    status: checked === 0 ? ValidationStatus.WARN : ok ? ValidationStatus.PASS : ValidationStatus.FAIL,
    message:
      checked === 0
        ? 'Biểu không có phân cấp chất lượng để kiểm tra'
        : ok
          ? `Σ cấp chất lượng = tổng số cho ${checked} dòng`
          : `${offenders.length} dòng Σ cấp chất lượng ≠ tổng số`,
    details: { checked, offenders },
  };
}

// Completeness: đánh dấu NO_DATA (nguồn thiếu dòng) — WARN, KHÔNG quy 0 (BR-DT11-009).
export function validateCompleteness(payload: DatasetPayload): ValidationResult {
  let noData = 0;
  let zero = 0;
  let value = 0;
  for (const r of payload.rows) {
    for (const c of Object.values(r.cells)) {
      if (c.state === CellState.NO_DATA) noData++;
      else if (c.state === CellState.ZERO) zero++;
      else if (c.state === CellState.VALUE) value++;
    }
  }
  return {
    checkType: ValidationCheckType.COMPLETENESS,
    status: noData > 0 ? ValidationStatus.WARN : ValidationStatus.PASS,
    message:
      noData > 0
        ? `Có ${noData} ô NO_DATA (nguồn chưa có dữ liệu — không tính = 0)`
        : `Đủ dữ liệu (${value} ô có giá trị, ${zero} ô = 0)`,
    details: { noData, zero, value },
  };
}

export function isBlockingValidation(results: ValidationResult[]): boolean {
  return results.some((r) => r.status === ValidationStatus.FAIL);
}

// Tổng hợp rollup: CHỈ cộng đơn vị con SUBMITTED; dedupe theo child_org (chống aggregate trùng — BR-DT11-021).
// Đơn vị MISSING giữ riêng, KHÔNG cộng như 0 (BR-DT11-020).
export interface RollupChild {
  childOrgId: string;
  submissionStatus: SubmissionStatus;
  totals: Record<string, number>; // tổng theo trường từ báo cáo con
}
export interface RollupResult {
  aggregatedTotals: Record<string, number>;
  submittedOrgIds: string[];
  missingOrgIds: string[];
}
// Evaluator công thức dataset an toàn (chỉ +, -, *, /, (), số, field_key). KHÔNG dùng eval/Function.
// Trả null nếu thiếu biến (giữ NO_DATA, không quy 0). Shunting-yard → RPN.
export function evalFormula(expr: string, scope: Record<string, number | null>): number | null {
  const tokens = expr.match(/(\d+\.?\d*|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/])/g);
  if (!tokens) return null;
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const out: string[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (/^\d/.test(t) || /^[A-Za-z_]/.test(t)) out.push(t);
    else if (t === '(') ops.push(t);
    else if (t === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!);
      ops.pop();
    } else {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop()!);
      ops.push(t);
    }
  }
  while (ops.length) out.push(ops.pop()!);
  const st: (number | null)[] = [];
  for (const t of out) {
    if (t in prec) {
      const b = st.pop();
      const a = st.pop();
      if (a === null || a === undefined || b === null || b === undefined) return null;
      st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : b === 0 ? null : a / b);
    } else if (/^\d/.test(t)) st.push(Number(t));
    else {
      const v = scope[t];
      st.push(v === undefined ? null : v);
    }
  }
  const r = st.pop();
  return r === undefined ? null : r;
}

export function aggregateRollup(children: RollupChild[]): RollupResult {
  const seen = new Set<string>();
  const aggregatedTotals: Record<string, number> = {};
  const submittedOrgIds: string[] = [];
  const missingOrgIds: string[] = [];
  for (const c of children) {
    if (seen.has(c.childOrgId)) continue; // idempotent: mỗi đơn vị con chỉ cộng 1 lần
    seen.add(c.childOrgId);
    if (c.submissionStatus !== SubmissionStatus.SUBMITTED) {
      missingOrgIds.push(c.childOrgId);
      continue;
    }
    submittedOrgIds.push(c.childOrgId);
    for (const [k, v] of Object.entries(c.totals)) {
      aggregatedTotals[k] = (aggregatedTotals[k] ?? 0) + (Number(v) || 0);
    }
  }
  return { aggregatedTotals, submittedOrgIds, missingOrgIds };
}
