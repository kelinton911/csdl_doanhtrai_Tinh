import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-09 — Nguồn địa bàn & cân đối bảo đảm (Quyển IX). Client gọi /territorial-sources, /balance-plans…
// (không chứa business rule — chỉ hiển thị + gọi API).

interface Paged<T> {
  data: T[];
  meta: { page: number; size: number; total: number };
}

// ---------------- Kiểu dữ liệu ----------------
export interface TerritorialSource {
  id: string;
  sourceCode: string;
  name: string;
  adminUnitId: string;
  sourceType: string;
  ownerName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface SourceVerificationView {
  id: string;
  status: string; // UNVERIFIED | VERIFIED | EXPIRED
  effectiveStatus: string;
  verifiedQty: number | null;
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface MobilizationView {
  id: string;
  mobilizableQty: number;
  leadTimeDays: number;
  readinessLevel: string;
  assessedAt: string;
}

export interface SourceMaterialView {
  id: string;
  sourceId: string;
  materialCatalogId: string;
  declaredQty: string;
  unitId: string | null;
  status: string;
  verification: SourceVerificationView | null;
  mobilization: MobilizationView | null;
}

export interface SourceDetail extends TerritorialSource {
  materials: SourceMaterialView[];
}

export interface BalanceLineView {
  id: string;
  planId: string;
  materialCatalogId: string;
  unitId?: string | null;
  supplyRequired: number;
  plannedSourceQty: number;
  gapQty: number;
  status: string; // OPEN | PARTIAL | COVERED
}

export interface BalancePlan {
  id: string;
  planCode: string;
  name: string;
  scenarioRunId: string;
  status: string; // DRAFT | BALANCED | APPROVED | LOCKED
  revisionNo: number;
  deadlineDays: number | null;
  sourceOutputHash: string | null;
  checksum: string | null;
  sourceFingerprint: string | null;
  lines?: BalanceLineView[];
}

export interface RankedCandidate {
  sourceMaterialId: string;
  sourceId: string;
  sourceCode: string | null;
  sourceName: string | null;
  availableQty: number;
  mobilizableQty: number;
  leadTimeDays: number | null;
  distanceKm: number | null;
  priority: number;
  rank: number;
}

export interface RejectedCandidate {
  sourceMaterialId: string;
  reason: string;
}

export interface CandidateResult {
  line: BalanceLineView;
  ranked: RankedCandidate[];
  rejected: RejectedCandidate[];
}

export interface GapSummary {
  planId: string;
  planCode: string;
  status: string;
  totals: { supplyRequired: number; plannedSourceQty: number; gapQty: number; deliveredQty: number };
  lines: Array<{
    lineId: string;
    materialCatalogId: string;
    supplyRequired: number;
    plannedSourceQty: number;
    gapQty: number;
    deliveredQty: number;
    status: string;
  }>;
}

export const VERIFY_STATUS_LABEL: Record<string, string> = {
  UNVERIFIED: 'Chưa xác minh',
  VERIFIED: 'Đã xác minh',
  EXPIRED: 'Hết hạn',
};

export const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  BALANCED: 'Đã cân đối',
  APPROVED: 'Đã duyệt',
  LOCKED: 'Đã khóa (snapshot)',
};

export const REJECT_REASON_LABEL: Record<string, string> = {
  MATERIAL_MISMATCH: 'Khác vật chất',
  NOT_VERIFIED: 'Chưa xác minh',
  EXPIRED: 'Hết hạn xác minh',
  NOT_MOBILIZABLE: 'Chưa đánh giá/không huy động được',
  NO_AVAILABLE: 'Đã giữ hết khả dụng',
  OUT_OF_RADIUS: 'Ngoài bán kính',
  LEAD_TIME_EXCEEDED: 'Lead-time vượt hạn',
};

// ---------------- Hooks (đọc) ----------------
export function useSources(params: { adminUnitId?: string; sourceType?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ['dt09', 'sources', params],
    queryFn: async () =>
      (await api.get<Paged<TerritorialSource>>('/territorial-sources', { params: { size: 100, ...params } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useSource(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['dt09', 'source', id],
    queryFn: async () => (await api.get<SourceDetail>(`/territorial-sources/${id}`)).data,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ['dt09', 'plans'],
    queryFn: async () => (await api.get<Paged<BalancePlan>>('/balance-plans', { params: { size: 100 } })).data,
  });
}

export function usePlan(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['dt09', 'plan', id],
    queryFn: async () => (await api.get<BalancePlan>(`/balance-plans/${id}`)).data,
    placeholderData: keepPreviousData,
  });
}

export function useCandidates(planId: string | undefined, lineId: string | undefined, deadlineDays?: number | null) {
  return useQuery({
    enabled: !!planId && !!lineId,
    queryKey: ['dt09', 'candidates', planId, lineId, deadlineDays],
    queryFn: async () =>
      (
        await api.get<CandidateResult>(`/balance-plans/${planId}/candidates`, {
          params: { line: lineId, deadlineDays: deadlineDays ?? undefined },
        })
      ).data,
  });
}

export function useGapSummary(planId: string | undefined) {
  return useQuery({
    enabled: !!planId,
    queryKey: ['dt09', 'gap', planId],
    queryFn: async () => (await api.get<GapSummary>(`/balance-plans/${planId}/gap-summary`)).data,
  });
}

// ---------------- Actions (ghi) ----------------
export async function createSource(body: {
  name: string;
  adminUnitId: string;
  sourceType: string;
  ownerName?: string;
  contactName?: string;
  contactPhone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  effectiveFrom?: string;
}) {
  return (await api.post<TerritorialSource>('/territorial-sources', body)).data;
}

export async function addMaterial(sourceId: string, body: { materialCatalogId: string; declaredQty: number; unitId?: string }) {
  return (await api.post(`/territorial-sources/${sourceId}/materials`, body)).data;
}

export async function verifyMaterial(sourceMaterialId: string, body: { status: string; verifiedQty?: number; expiresAt?: string; method?: string; note?: string }) {
  return (await api.post(`/source-materials/${sourceMaterialId}/verify`, body)).data;
}

export async function assessMobilization(sourceMaterialId: string, body: { mobilizableQty: number; leadTimeDays: number; readinessLevel?: string; note?: string }) {
  return (await api.post(`/source-materials/${sourceMaterialId}/assess-mobilization`, body)).data;
}

export async function createPlan(body: { name: string; scenarioRunId: string; deadlineDays?: number }) {
  return (await api.post<BalancePlan>('/balance-plans', body)).data;
}

export async function balancePlan(id: string) {
  return (await api.post<BalancePlan>(`/balance-plans/${id}/balance`, {})).data;
}

export async function approvePlan(id: string) {
  return (await api.post<BalancePlan>(`/balance-plans/${id}/approve`, {})).data;
}

export async function lockPlan(id: string) {
  return (await api.post(`/balance-plans/${id}/lock`, {})).data;
}

export async function revisePlan(id: string) {
  return (await api.post<BalancePlan>(`/balance-plans/${id}/revise`, {})).data;
}

export async function reserveSource(lineId: string, body: { sourceMaterialId: string; reservedQty: number; priority?: number }) {
  return (await api.post(`/balance-lines/${lineId}/reservations`, body)).data;
}

export async function releaseReservation(id: string) {
  return (await api.post(`/reservations/${id}/release`, {})).data;
}

export async function createExecutionRequest(lineId: string, body: { requestedQty: number; targetOrg?: string; spawnDocument?: boolean; organizationId?: string; effectiveDate?: string }) {
  return (await api.post(`/balance-lines/${lineId}/execution-requests`, body)).data;
}

export async function sendFeedback(executionRequestId: string, body: { deliveredQty: number; feedbackNote?: string }) {
  return (await api.post(`/execution-requests/${executionRequestId}/feedback`, body)).data;
}
