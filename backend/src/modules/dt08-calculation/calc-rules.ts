import { createHash } from 'crypto';
import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { CalculationScenarioStatus } from '../../common/enums';

// Quy tắc miền DT-08 (Quyển VIII §II/§VII) — hàm THUẦN, kiểm thử trực tiếp.
// Engine tính NHU CẦU bảo đảm: kết hợp định mức (DT-07) + thực lực HC (DT-04) +
// dự trữ SSCĐ (DT-06). Công thức lõi bất biến toàn hệ thống:
//   TT  = TT_GĐCB + TT_GĐCĐ            (tiêu thụ = chuẩn bị + chiến đấu)
//   NC  = TT + PC_SSCĐ − HC            (nhu cầu = tiêu thụ + dự trữ SSCĐ − hiện có)
//   supply_required = max(NC, 0)       (trường DẪN XUẤT — KHÔNG ghi 0 vào NC)
// NC âm GIỮ NGUYÊN dấu (BR-DT08-004). supply_required là max(NC,0) (BR-DT08-006).

// Phiên bản engine — vào input/output hash để tái lập (BR-DT08-016/017).
export const ENGINE_VERSION = 'dt08-need-v1';

// ---- Vòng đời scenario (Quyển VIII §VIII) — DRAFT→CALCULATED→LOCKED ----
// Dùng enum chuẩn common. LOCKED bất biến; sửa nguồn → clone/revision (BR-DT08-011/012).
export { CalculationScenarioStatus };

export const SCENARIO_TRANSITIONS: Partial<Record<CalculationScenarioStatus, CalculationScenarioStatus[]>> = {
  [CalculationScenarioStatus.DRAFT]: [CalculationScenarioStatus.CALCULATED, CalculationScenarioStatus.SUPERSEDED],
  [CalculationScenarioStatus.CALCULATED]: [CalculationScenarioStatus.LOCKED, CalculationScenarioStatus.SUPERSEDED],
  [CalculationScenarioStatus.LOCKED]: [], // bất biến — revise = clone bản mới
  [CalculationScenarioStatus.SUPERSEDED]: [],
};

// ---- Trạng thái lần chạy (calculation_run) ----
export enum CalculationRunStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ---- Trạng thái định mức trên từng dòng vật chất (đồng bộ DT-07 resolve) ----
// NO_RULE/CONFLICT KHÔNG quy 0 — đánh dấu dòng cần xử lý (SYS-BR-04, BR-DT08-008).
export type MaterialRuleStatus = 'SELECTED' | 'NO_RULE' | 'CONFLICT';

// ---- Trạng thái HC cho từng dòng (BR-DT08-021) ----
// OK = lấy từ hc_snapshot as-of; NO_HC_SNAPSHOT = không có snapshot (KHÔNG đọc số dư sống).
export type HcStatus = 'OK' | 'NO_HC_SNAPSHOT';

// ---- Giai đoạn tiêu thụ ↔ semantic_param định mức (DT-07) ----
export enum CalcPhase {
  PREPARATION = 'PREPARATION', // GĐCB
  COMBAT = 'COMBAT', // GĐCĐ
}

export const PHASE_SEMANTIC: Record<CalcPhase, string> = {
  [CalcPhase.PREPARATION]: 'CONSUMPTION_PREPARATION',
  [CalcPhase.COMBAT]: 'CONSUMPTION_COMBAT',
};

// LOCK bất biến: sửa scenario/run đã LOCKED → LOCKED_IMMUTABLE (BR-DT08-011).
export function assertScenarioEditable(status: CalculationScenarioStatus): void {
  if (status === CalculationScenarioStatus.LOCKED || status === CalculationScenarioStatus.SUPERSEDED) {
    throw new BusinessException(
      BusinessError.LOCKED_IMMUTABLE,
      `Kịch bản trạng thái ${status} bất biến — hãy tạo bản sửa (revise/clone) (BR-DT08-011)`,
    );
  }
}

// -----------------------------------------------------------------------------
// CÔNG THỨC LÕI (Quyển VIII §II) — hàm thuần, không chạm DB.
// -----------------------------------------------------------------------------

// Đóng góp tiêu thụ của một giai đoạn: đơn giá định mức × quy mô × số ngày.
export interface PhaseContribution {
  unitValue: number; // giá trị định mức đã resolve (đơn vị/đầu mối/ngày)
  scale: number; // quy mô (quân số/đầu mối) — mặc định 1
  days: number; // số ngày của giai đoạn — mặc định 1
}

export interface NeedInput {
  prep: PhaseContribution | null; // null = giai đoạn không áp cho vật chất này
  combat: PhaseContribution | null;
  pcSscd: number; // dự trữ SSCĐ phải có (DT-06) — mặc định 0
  hc: number; // hiện có tại thời điểm (DT-04 hc_snapshot)
}

export interface NeedResult {
  ttGdcb: number; // TT_GĐCB — LƯU RIÊNG (BR-DT08-020)
  ttGdcd: number; // TT_GĐCĐ — LƯU RIÊNG (BR-DT08-020)
  tt: number; // TT = TT_GĐCB + TT_GĐCĐ
  pcSscd: number;
  hc: number;
  nc: number; // NC = TT + PC_SSCĐ − HC (giữ dấu âm — BR-DT08-004)
  supplyRequired: number; // max(NC, 0) — dẫn xuất (BR-DT08-006)
}

// Làm tròn 4 chữ số để tránh nhiễu dấu phẩy động (đơn vị vật chất scale=3..4).
function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

function contribution(p: PhaseContribution | null): number {
  if (!p) return 0;
  return p.unitValue * (p.scale ?? 1) * (p.days ?? 1);
}

// TT/NC/supply_required cho MỘT vật chất. NC âm KHÔNG bị ghi 0 (dẫn xuất riêng).
export function computeMaterialNeed(input: NeedInput): NeedResult {
  const ttGdcb = round4(contribution(input.prep));
  const ttGdcd = round4(contribution(input.combat));
  const tt = round4(ttGdcb + ttGdcd);
  const pcSscd = round4(input.pcSscd ?? 0);
  const hc = round4(input.hc ?? 0);
  const nc = round4(tt + pcSscd - hc); // GIỮ NGUYÊN dấu (âm nếu HC dư)
  const supplyRequired = round4(Math.max(nc, 0));
  return { ttGdcb, ttGdcd, tt, pcSscd, hc, nc, supplyRequired };
}

// Trạng thái dòng theo tập trạng thái resolve của các giai đoạn khai báo:
//  CONFLICT nếu có ≥1 CONFLICT; NO_RULE nếu có ≥1 NO_RULE; ngược lại SELECTED.
// NO_RULE/CONFLICT → dòng KHÔNG được tính (không quy 0 âm thầm — BR-DT08-008).
export function determineLineStatus(statuses: MaterialRuleStatus[]): MaterialRuleStatus {
  if (statuses.some((s) => s === 'CONFLICT')) return 'CONFLICT';
  if (statuses.some((s) => s === 'NO_RULE')) return 'NO_RULE';
  return 'SELECTED';
}

// -----------------------------------------------------------------------------
// HASH TÁI LẬP (Quyển VIII §VII, BR-DT08-016/017)
// Cùng input_hash + engine_version ⇒ cùng output_hash.
// -----------------------------------------------------------------------------

// Chuỗi hóa ổn định: khóa object sắp xếp để hash không phụ thuộc thứ tự.
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function sha256Hex(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}

// input_hash: mọi thứ ảnh hưởng kết quả — scope, mốc thời gian, engine, snapshot HC.
export interface CalcInputForHash {
  scenarioCode: string;
  scope: Record<string, unknown>;
  effectiveTime: string;
  engineVersion: string;
  hcSnapshotId: string | null;
}

export function computeInputHash(input: CalcInputForHash): string {
  return sha256Hex(input);
}

// output_hash: tập kết quả từng vật chất (sắp xếp theo material để ổn định).
export interface CalcOutputLineForHash {
  materialCatalogId: string;
  ruleStatus: MaterialRuleStatus;
  hcStatus: HcStatus;
  ttGdcb: number | null;
  ttGdcd: number | null;
  tt: number | null;
  pcSscd: number | null;
  hc: number | null;
  nc: number | null;
  supplyRequired: number | null;
}

export function computeOutputHash(lines: CalcOutputLineForHash[], engineVersion: string): string {
  const sorted = [...lines].sort((a, b) => a.materialCatalogId.localeCompare(b.materialCatalogId));
  return sha256Hex({ engineVersion, lines: sorted });
}

// So sánh 2 lần chạy: ΔNC theo vật chất + nguyên nhân (scenario_comparison).
export interface CompareLine {
  materialCatalogId: string;
  baseNc: number | null;
  targetNc: number | null;
  deltaNc: number | null;
  baseSupply: number | null;
  targetSupply: number | null;
  deltaSupply: number | null;
  baseStatus: string;
  targetStatus: string;
  changed: boolean;
}

export interface RunLineLike {
  materialCatalogId: string;
  nc: number | null;
  supplyRequired: number | null;
  ruleStatus: string;
}

// ΔNC = NC(target) − NC(base). Ghép theo material; thiếu bên nào → null bên đó.
export function compareRuns(base: RunLineLike[], target: RunLineLike[]): CompareLine[] {
  const byMat = new Map<string, { base?: RunLineLike; target?: RunLineLike }>();
  for (const b of base) byMat.set(b.materialCatalogId, { ...(byMat.get(b.materialCatalogId) ?? {}), base: b });
  for (const t of target) byMat.set(t.materialCatalogId, { ...(byMat.get(t.materialCatalogId) ?? {}), target: t });

  const out: CompareLine[] = [];
  for (const [materialCatalogId, { base: b, target: t }] of byMat) {
    const baseNc = b?.nc ?? null;
    const targetNc = t?.nc ?? null;
    const deltaNc = baseNc !== null && targetNc !== null ? round4(targetNc - baseNc) : null;
    const baseSupply = b?.supplyRequired ?? null;
    const targetSupply = t?.supplyRequired ?? null;
    const deltaSupply = baseSupply !== null && targetSupply !== null ? round4(targetSupply - baseSupply) : null;
    const baseStatus = b?.ruleStatus ?? 'MISSING';
    const targetStatus = t?.ruleStatus ?? 'MISSING';
    // Đổi khi: thiếu một bên, khác trạng thái, hoặc NC lệch. Hai bên cùng NULL + cùng
    // trạng thái (NO_RULE/CONFLICT không đổi) ⇒ KHÔNG coi là đổi.
    const present = b !== undefined && t !== undefined;
    const ncChanged = deltaNc !== null ? deltaNc !== 0 : baseNc !== targetNc;
    const changed = !present || baseStatus !== targetStatus || ncChanged;
    out.push({
      materialCatalogId,
      baseNc,
      targetNc,
      deltaNc,
      baseSupply,
      targetSupply,
      deltaSupply,
      baseStatus,
      targetStatus,
      changed,
    });
  }
  return out.sort((a, b) => a.materialCatalogId.localeCompare(b.materialCatalogId));
}
