import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-07 — Định mức có căn cứ + bộ chọn deterministic + Chỉ lệnh hậu cần.
// Client gọi API /norms, /norm-sets, /commands… (không chứa business rule).

export interface NormSet {
  id: string;
  setCode: string;
  name: string;
  description: string | null;
}

export interface NormSetVersion {
  id: string;
  normSetId: string;
  versionLabel: string;
  documentVersionId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: string; // DRAFT | VALIDATED | PUBLISHED | SUPERSEDED | ARCHIVED
  publishedAt: string | null;
}

export interface MaterialNorm {
  id: string;
  normSetVersionId: string;
  materialCatalogId: string;
  semanticParam: string;
  valueType: string;
  valueNumeric: string | null;
  rawValue: string | null;
  unitId: string | null;
  sourceStatus: string; // VERIFIED | LEGACY_UNVERIFIED
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface CalculationParameter {
  id: string;
  semanticParam: string;
  description: string;
}

export interface NormativeDocument {
  id: string;
  docNo: string;
  title: string;
  issuingAuthority: string;
  issueDate: string | null;
}

export interface NormConflict {
  id: string;
  resolveRequestHash: string;
  materialCatalogId: string;
  semanticParam: string;
  candidateNormIds: string[];
  requestScope: Record<string, unknown>;
  status: string; // OPEN | RESOLVED
  resolutionNote: string | null;
  resolvedNormId: string | null;
  createdAt: string;
}

export interface CommandItem {
  id: string;
  commandNo: string;
  title: string;
  issuingAuthority: string;
  effectiveDate: string | null;
  status: string;
}

export interface ResolveScope {
  org?: string;
  territory?: string;
  mission?: string;
  phase?: string;
  quality?: string;
  scale?: string;
  time?: string;
}

export interface TraceCandidate {
  normId: string;
  eligible: boolean;
  matchedDimensions: string[];
  specificity: number;
  authorityRank: number | null;
  reason?: string;
}

export interface ResolveResult {
  status: 'SELECTED' | 'NO_RULE' | 'CONFLICT';
  selected?: {
    normId: string;
    valueType: string;
    valueNumeric: number | null;
    rawValue: string | null;
    unitId: string | null;
    formulaExpr: string | null;
  };
  candidateNormIds?: string[];
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
  asOfTime: string;
  sourceReference?: {
    id: string;
    pageNo: number | null;
    lineRef: string | null;
    quoteText: string | null;
    appendixCode: string | null;
  } | null;
}

interface Paged<T> {
  data: T[];
  meta: { page: number; size: number; total: number };
}

// ---- Nhãn tiếng Việt ----
export const RESOLVE_STATUS_LABEL: Record<string, string> = {
  SELECTED: 'Đã chọn định mức',
  NO_RULE: 'Không có định mức (không tính = 0)',
  CONFLICT: 'Xung đột — cần giải quyết',
};

export const SOURCE_STATUS_LABEL: Record<string, string> = {
  VERIFIED: 'Có căn cứ',
  LEGACY_UNVERIFIED: 'Chưa căn cứ (legacy)',
};

export const DIMENSION_LABEL: Record<string, string> = {
  MATERIAL: 'Vật chất',
  ORG: 'Đơn vị',
  TERRITORY: 'Địa bàn',
  MISSION: 'Nhiệm vụ',
  PHASE: 'Giai đoạn',
  QUALITY: 'Chất lượng',
  SCALE: 'Quy mô',
  TIME: 'Thời kỳ',
};

// ---- Hooks (đọc) ----
export function useNormSets() {
  return useQuery({
    queryKey: ['dt07', 'sets'],
    queryFn: async () => (await api.get<Paged<NormSet>>('/norm-sets', { params: { size: 100 } })).data,
  });
}

export function useSetVersions(setId: string | undefined) {
  return useQuery({
    enabled: !!setId,
    queryKey: ['dt07', 'set-versions', setId],
    queryFn: async () => (await api.get<NormSetVersion[]>(`/norm-sets/${setId}/versions`)).data,
    placeholderData: keepPreviousData,
  });
}

export function useNorms(versionId: string | undefined) {
  return useQuery({
    enabled: !!versionId,
    queryKey: ['dt07', 'norms', versionId],
    queryFn: async () => (await api.get<MaterialNorm[]>(`/norm-set-versions/${versionId}/norms`)).data,
    placeholderData: keepPreviousData,
  });
}

export function useCalcParams() {
  return useQuery({
    queryKey: ['dt07', 'calc-params'],
    queryFn: async () => (await api.get<CalculationParameter[]>('/calculation-parameters')).data,
  });
}

export function useNormDocuments() {
  return useQuery({
    queryKey: ['dt07', 'documents'],
    queryFn: async () => (await api.get<Paged<NormativeDocument>>('/normative-documents', { params: { size: 100 } })).data,
  });
}

export function useConflicts(status?: string) {
  return useQuery({
    queryKey: ['dt07', 'conflicts', status ?? 'all'],
    queryFn: async () => (await api.get<NormConflict[]>('/norm-conflicts', { params: { status } })).data,
  });
}

export function useCommands() {
  return useQuery({
    queryKey: ['dt07', 'commands'],
    queryFn: async () => (await api.get<Paged<CommandItem>>('/commands', { params: { size: 100 } })).data,
  });
}

// ---- Actions (ghi) ----
export async function resolveNorm(body: {
  materialCatalogId: string;
  semanticParam: string;
  scope?: ResolveScope;
  asOfTime?: string;
}): Promise<ResolveResult> {
  return (await api.post<ResolveResult>('/norms/resolve', body)).data;
}

export async function publishSetVersion(id: string) {
  return (await api.post<NormSetVersion>(`/norm-set-versions/${id}/publish`, {})).data;
}

export async function resolveConflict(id: string, body: { resolvedNormId: string; resolutionNote?: string }) {
  return (await api.post<NormConflict>(`/norm-conflicts/${id}/resolve`, body)).data;
}
