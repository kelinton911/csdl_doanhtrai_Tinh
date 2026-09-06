import { ScopeContext } from '../scope/scope-context';
import { toHcmIso } from '../time/as-of';

// Nguồn dữ liệu "tại thời điểm": lấy từ snapshot đã chốt hay tính từ sổ cái.
export type AsOfSource = 'snapshot' | 'ledger';

export interface AsOfMeta {
  as_of_time: string; // ISO-8601 +07:00
  scope: {
    organizationId?: string | null;
    areaIds?: string[];
    missionIds?: string[];
    provinceWide?: boolean;
  };
  source: AsOfSource;
  locked: boolean; // dữ liệu đã khóa (snapshot/kỳ chốt) → bất biến.
}

export interface AsOfResponse<T> {
  data: T;
  meta: AsOfMeta;
}

// Bọc dữ liệu truy vấn "tại thời điểm" kèm as_of_time/scope/source/locked
// (Sprint 0 §1 GAP-5 — tái dùng cho DT-04/08/10).
export function asOfResponse<T>(
  data: T,
  opts: {
    asOf: Date;
    source: AsOfSource;
    locked?: boolean;
    scope?: ScopeContext | AsOfMeta['scope'];
  },
): AsOfResponse<T> {
  const scope =
    opts.scope && 'provinceWide' in opts.scope
      ? {
          organizationId: opts.scope.organizationId,
          areaIds: opts.scope.areaIds,
          missionIds: opts.scope.missionIds,
          provinceWide: opts.scope.provinceWide,
        }
      : opts.scope ?? {};
  return {
    data,
    meta: {
      as_of_time: toHcmIso(opts.asOf),
      scope,
      source: opts.source,
      locked: opts.locked ?? false,
    },
  };
}
