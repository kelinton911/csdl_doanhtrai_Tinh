import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { CatalogVersionStatus } from '../../common/enums';

// Quy tắc miền DT-07 (Quyển VII §II/§VII) — hàm THUẦN, kiểm thử trực tiếp.
// Kho định mức CÓ CĂN CỨ + bộ chọn định mức DETERMINISTIC phục vụ DT-08.
// Nguyên tắc: không có định mức → NO_RULE (KHÔNG ngầm = 0); xung đột ngang ưu tiên →
// CONFLICT (KHÔNG tự chọn). Mọi lựa chọn phải GIẢI THÍCH ĐƯỢC (explanation trace).

// ---- Kiểu giá trị định mức (Quyển VII §VIII) ----
export enum NormValueType {
  FIXED = 'FIXED', // cố định (vd: 0.9 kg/người/ngày)
  PER_UNIT = 'PER_UNIT', // theo đầu mối (vd: /xe, /khẩu)
  FORMULA = 'FORMULA', // biểu thức (DT-08 diễn giải)
  LOOKUP = 'LOOKUP', // tra bảng phụ lục
}

// ---- Ngữ nghĩa tham số (semantic_param) — phân biệt GĐCB/GĐCĐ/PC/dự trữ ----
// Lưu dạng varchar để mở rộng; enum liệt kê các mã chuẩn hay dùng (đối chiếu §8 quy ước).
export enum SemanticParam {
  CONSUMPTION_PREPARATION = 'CONSUMPTION_PREPARATION', // GĐCB — tiêu thụ giai đoạn chuẩn bị
  CONSUMPTION_COMBAT = 'CONSUMPTION_COMBAT', // GĐCĐ — tiêu thụ giai đoạn chiến đấu
  POST_COMBAT_REQUIRED = 'POST_COMBAT_REQUIRED', // SEM-PC-SCD — phải có sau chiến đấu
  RESERVE_REGULAR = 'RESERVE_REGULAR', // dự trữ thường xuyên
  RESERVE_SSCD = 'RESERVE_SSCD', // dự trữ sẵn sàng chiến đấu
}

// ---- Chiều phạm vi (norm_dimension) — định mức áp theo bối cảnh đa chiều ----
export enum DimensionType {
  MATERIAL = 'MATERIAL', // vật chất (ngầm theo material_catalog_id)
  ORG = 'ORG', // đơn vị/cấp
  TERRITORY = 'TERRITORY', // địa bàn
  MISSION = 'MISSION', // nhiệm vụ (tiến công/phòng ngự…)
  PHASE = 'PHASE', // giai đoạn (chuẩn bị/thực hành)
  QUALITY = 'QUALITY', // cấp chất lượng
  SCALE = 'SCALE', // quy mô
  TIME = 'TIME', // mốc thời gian/thời kỳ
}

// ---- Tình trạng căn cứ pháp lý của định mức (BR-DT07-026) ----
export enum NormSourceStatus {
  VERIFIED = 'VERIFIED', // có văn bản căn cứ (file_hash + trang/dòng) → dùng chính thức
  LEGACY_UNVERIFIED = 'LEGACY_UNVERIFIED', // chưa có căn cứ → KHÔNG dùng cho resolve chính thức
}

// norm_set_version dùng CatalogVersionStatus chung (§3): DRAFT→VALIDATED→PUBLISHED→SUPERSEDED→ARCHIVED.
export { CatalogVersionStatus as NormSetStatus };

// ---- Hàng chờ xung đột định mức ----
export enum NormConflictStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

// ---- Vòng đời Chỉ lệnh hậu cần (Quyển VII §XV) ----
export enum CommandStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED', // đã phát hành (bất biến — sửa → version mới)
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export const COMMAND_TRANSITIONS: Record<CommandStatus, CommandStatus[]> = {
  [CommandStatus.DRAFT]: [CommandStatus.ISSUED, CommandStatus.CANCELLED],
  [CommandStatus.ISSUED]: [CommandStatus.IN_PROGRESS, CommandStatus.CANCELLED],
  [CommandStatus.IN_PROGRESS]: [CommandStatus.COMPLETED, CommandStatus.CANCELLED],
  [CommandStatus.COMPLETED]: [],
  [CommandStatus.CANCELLED]: [],
};

// ---- BR-DT07-002 (TC-DT07-002): bộ định mức PUBLISHED/SUPERSEDED BẤT BIẾN ----
// Sửa nội dung định mức trên bộ đã công bố → buộc tạo version mới.
export function assertNormSetEditable(status: CatalogVersionStatus): void {
  if (
    status === CatalogVersionStatus.PUBLISHED ||
    status === CatalogVersionStatus.SUPERSEDED ||
    status === CatalogVersionStatus.ARCHIVED
  ) {
    throw new BusinessException(
      BusinessError.LOCKED_IMMUTABLE,
      `Bộ định mức trạng thái ${status} bất biến — hãy tạo version mới (BR-DT07-002)`,
    );
  }
}

// ---------------------------------------------------------------------------
// BỘ CHỌN ĐỊNH MỨC DETERMINISTIC (Quyển VII §VII, BR-DT07-007/008/009/016/026/027)
// ---------------------------------------------------------------------------

export type ResolveStatus = 'SELECTED' | 'NO_RULE' | 'CONFLICT';

// Một định mức ứng viên (đã lấy từ CSDL, bộ đã PUBLISHED). Hàm chọn KHÔNG chạm DB.
export interface NormCandidate {
  normId: string;
  materialCatalogId: string;
  semanticParam: string;
  sourceStatus: NormSourceStatus;
  valueType: string;
  valueNumeric: number | null;
  rawValue: string | null;
  unitId: string | null;
  formulaExpr: string | null;
  effectiveFrom: Date | string | null;
  effectiveTo: Date | string | null;
  issuingAuthority: string | null; // để xếp hạng khi đồng ưu tiên (authority_rank)
  dimensions: Array<{ dimensionType: string; dimensionValue: string }>;
}

// Bối cảnh yêu cầu (DT-08 gửi vào /norms/resolve).
export interface ResolveScope {
  org?: string | null;
  territory?: string | null;
  mission?: string | null;
  phase?: string | null;
  quality?: string | null;
  scale?: string | null;
  time?: string | null;
}

export interface ResolveRequestInput {
  materialCatalogId: string;
  semanticParam: string;
  scope?: ResolveScope;
  asOf: Date;
}

export interface TraceCandidate {
  normId: string;
  eligible: boolean;
  matchedDimensions: string[];
  specificity: number;
  authorityRank: number | null;
  reason?: string; // vì sao bị loại (nếu !eligible)
}

export interface ResolveResult {
  status: ResolveStatus;
  selected?: {
    normId: string;
    valueType: string;
    valueNumeric: number | null;
    rawValue: string | null;
    unitId: string | null;
    formulaExpr: string | null;
  };
  candidateNormIds?: string[]; // khi CONFLICT
  trace: {
    materialCatalogId: string;
    semanticParam: string;
    scope: ResolveScope;
    asOf: string;
    strategy: string;
    maxSpecificity: number | null;
    authorityRankApplied: boolean;
    considered: TraceCandidate[];
    decision: string;
  };
}

function toTime(v: Date | string | null): number | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// BR-DT07-016: định mức hết hiệu lực KHÔNG áp cho as_of sau khi hết hiệu lực.
export function withinEffective(
  asOf: Date,
  from: Date | string | null,
  to: Date | string | null,
): boolean {
  const t = asOf.getTime();
  const f = toTime(from);
  const e = toTime(to);
  if (f !== null && t < f) return false;
  if (e !== null && t > e) return false;
  return true;
}

// Ánh xạ bối cảnh yêu cầu → map theo DimensionType (MATERIAL ngầm theo material_catalog_id).
function scopeMap(req: ResolveRequestInput): Record<string, string | null | undefined> {
  const s = req.scope ?? {};
  return {
    [DimensionType.MATERIAL]: req.materialCatalogId,
    [DimensionType.ORG]: s.org,
    [DimensionType.TERRITORY]: s.territory,
    [DimensionType.MISSION]: s.mission,
    [DimensionType.PHASE]: s.phase,
    [DimensionType.QUALITY]: s.quality,
    [DimensionType.SCALE]: s.scale,
    [DimensionType.TIME]: s.time,
  };
}

// Bộ chọn định mức deterministic (BR-DT07-007):
//  1) Loại ứng viên không đủ điều kiện: khác semantic/vật chất, chưa có căn cứ
//     (LEGACY_UNVERIFIED — BR-DT07-026), hết hiệu lực tại as_of (BR-DT07-016),
//     hoặc có chiều phạm vi mà yêu cầu KHÔNG thỏa (mismatch).
//  2) Độ đặc thù = số chiều khớp; chọn nhóm đặc thù nhất (most-specific-wins).
//  3) Nếu >1 ở cùng độ đặc thù → xếp theo authority_rank (BR-DT07-027).
//     Vẫn còn >1 hạng cao nhất → CONFLICT, KHÔNG tự chọn (BR-DT07-008).
//  4) Không ứng viên nào đủ điều kiện → NO_RULE, KHÔNG trả 0 (BR-DT07-009).
export function resolveNorm(
  candidates: NormCandidate[],
  req: ResolveRequestInput,
  authorityRank: Record<string, number> = {},
): ResolveResult {
  const map = scopeMap(req);
  const considered: TraceCandidate[] = [];

  for (const c of candidates) {
    const matchedDimensions: string[] = [];
    let eligible = true;
    let reason: string | undefined;

    if (c.semanticParam !== req.semanticParam) {
      eligible = false;
      reason = `semantic ${c.semanticParam} ≠ ${req.semanticParam}`;
    } else if (c.materialCatalogId !== req.materialCatalogId) {
      eligible = false;
      reason = 'khác vật chất';
    } else if (c.sourceStatus !== NormSourceStatus.VERIFIED) {
      eligible = false;
      reason = 'LEGACY_UNVERIFIED — thiếu căn cứ (BR-DT07-026)';
    } else if (!withinEffective(req.asOf, c.effectiveFrom, c.effectiveTo)) {
      eligible = false;
      reason = 'hết hiệu lực tại as_of (BR-DT07-016)';
    } else {
      // Mọi chiều khai báo trên định mức PHẢI được yêu cầu thỏa (subset-match).
      for (const dim of c.dimensions) {
        if (dim.dimensionType === DimensionType.MATERIAL) {
          matchedDimensions.push(dim.dimensionType);
          continue; // đã khớp qua material_catalog_id
        }
        const requested = map[dim.dimensionType];
        if (requested !== undefined && requested !== null && requested === dim.dimensionValue) {
          matchedDimensions.push(dim.dimensionType);
        } else {
          eligible = false;
          reason = `chiều ${dim.dimensionType}=${dim.dimensionValue} không khớp bối cảnh`;
          break;
        }
      }
    }

    considered.push({
      normId: c.normId,
      eligible,
      matchedDimensions,
      specificity: matchedDimensions.length,
      authorityRank: c.issuingAuthority != null ? authorityRank[c.issuingAuthority] ?? null : null,
    });
    if (!eligible) considered[considered.length - 1].reason = reason;
  }

  const baseTrace = {
    materialCatalogId: req.materialCatalogId,
    semanticParam: req.semanticParam,
    scope: req.scope ?? {},
    asOf: req.asOf.toISOString(),
    strategy: 'MOST_SPECIFIC + AUTHORITY_RANK',
    considered,
  };

  const eligible = considered.filter((t) => t.eligible);
  if (eligible.length === 0) {
    return {
      status: 'NO_RULE',
      trace: {
        ...baseTrace,
        maxSpecificity: null,
        authorityRankApplied: false,
        decision: 'Không có định mức đủ điều kiện — NO_RULE (không trả 0, BR-DT07-009)',
      },
    };
  }

  const maxSpecificity = Math.max(...eligible.map((t) => t.specificity));
  const top = eligible.filter((t) => t.specificity === maxSpecificity);

  const pick = (normId: string, authorityRankApplied: boolean, decision: string): ResolveResult => {
    const c = candidates.find((x) => x.normId === normId)!;
    return {
      status: 'SELECTED',
      selected: {
        normId: c.normId,
        valueType: c.valueType,
        valueNumeric: c.valueNumeric,
        rawValue: c.rawValue,
        unitId: c.unitId,
        formulaExpr: c.formulaExpr,
      },
      trace: { ...baseTrace, maxSpecificity, authorityRankApplied, decision },
    };
  };

  if (top.length === 1) {
    return pick(top[0].normId, false, `Chọn định mức đặc thù nhất (${maxSpecificity} chiều khớp)`);
  }

  // Đồng độ đặc thù → xếp theo authority_rank (số nhỏ = ưu tiên cao). Thiếu hạng → thấp nhất.
  const ranked = top.map((t) => ({ t, rank: t.authorityRank ?? Number.POSITIVE_INFINITY }));
  const bestRank = Math.min(...ranked.map((r) => r.rank));
  const withBest = ranked.filter((r) => r.rank === bestRank);

  if (withBest.length === 1 && Number.isFinite(bestRank)) {
    return pick(
      withBest[0].t.normId,
      true,
      `Đồng độ đặc thù (${maxSpecificity}); tách bằng authority_rank=${bestRank}`,
    );
  }

  // Không tách được → CONFLICT (BR-DT07-008): KHÔNG tự chọn.
  return {
    status: 'CONFLICT',
    candidateNormIds: top.map((t) => t.normId),
    trace: {
      ...baseTrace,
      maxSpecificity,
      authorityRankApplied: withBest.length !== top.length,
      decision: `Xung đột: ${top.length} định mức ngang ưu tiên (không tự chọn, BR-DT07-008)`,
    },
  };
}

// Băm yêu cầu resolve để gom các lần xung đột giống nhau vào 1 case (norm_conflict_case).
export function resolveRequestHash(req: ResolveRequestInput): string {
  const s = req.scope ?? {};
  const parts = [
    req.materialCatalogId,
    req.semanticParam,
    s.org ?? '',
    s.territory ?? '',
    s.mission ?? '',
    s.phase ?? '',
    s.quality ?? '',
    s.scale ?? '',
    s.time ?? '',
  ];
  return parts.join('|');
}
