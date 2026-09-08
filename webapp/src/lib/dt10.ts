import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-10 — Kiểm kê & chốt số liệu (Quyển X). Client gọi /count-campaigns… (không chứa business rule).

interface Paged<T> {
  data: T[];
  meta: { page: number; size: number; total: number };
}

// ---------------- Kiểu dữ liệu ----------------
export interface Campaign {
  id: string;
  campaignCode: string;
  name: string;
  countType: string;
  scopeJson: Record<string, unknown>;
  cutoffTime: string | null;
  status: string;
  note: string | null;
}

export interface BookLine {
  id: string;
  materialCatalogId: string;
  lotId: string | null;
  locationId: string | null;
  bookQty: string;
  grade1: string; grade2: string; grade3: string; grade4: string; grade5: string;
}
export interface BookSnapshotView {
  snapshot: { id: string; asOf: string; checksum: string; locked: boolean };
  lines: BookLine[];
}

export interface Sheet {
  id: string;
  campaignId: string;
  organizationId: string | null;
  locationId: string | null;
  currentRound: number;
  status: string;
  submittedAt: string | null;
  note: string | null;
}
export interface SheetLine {
  id: string;
  sheetId: string;
  roundNo: number;
  materialCatalogId: string;
  lotId: string | null;
  locationId: string | null;
  physicalQty: string;
  note: string | null;
}
export interface SheetDetail {
  sheet: Sheet;
  lines: SheetLine[];
  rounds: Array<{ id: string; roundNo: number; reason: string | null }>;
}

export interface Variance {
  id: string;
  campaignId: string;
  materialCatalogId: string;
  lotId: string | null;
  bookQty: string;
  physicalQty: string;
  varianceQty: string;
  varianceType: string;
  status: string;
  resolutionNote: string | null;
}

export interface OfficialLine {
  id: string;
  materialCatalogId: string;
  lotId: string | null;
  officialQty: string;
}
export interface OfficialView {
  snapshot: { id: string; version: number; checksum: string; approvedAt: string | null; revisionReason: string | null };
  lines: OfficialLine[];
  locked: boolean;
}

export interface Adjustment {
  id: string;
  requestCode: string;
  materialCatalogId: string;
  beforeQty: string;
  proposedQty: string;
  proposedDelta: string;
  reasonCode: string;
  status: string;
  dt05DocumentId: string | null;
}

export interface Dataset {
  id: string;
  formCode: string;
  snapshotVersion: number;
  datasetHash: string;
  createdAt: string;
}

export interface Reconciliation {
  snapshotVersion: number;
  rows: Array<{ materialCatalogId: string; lotId: string | null; officialQty: number; hcNow: number; diff: number }>;
}

// ---------------- Nhãn trạng thái ----------------
export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  CUTOFF: 'Đã chốt cutoff',
  COUNTING: 'Đang kiểm đếm',
  RECONCILING: 'Đối chiếu',
  OFFICIAL_LOCKED: 'Đã khóa chính thức',
  ADJUSTING: 'Đang điều chỉnh',
  CLOSED: 'Đã đóng',
};
export const VARIANCE_TYPE_LABEL: Record<string, string> = {
  SHORTAGE: 'Thiếu', SURPLUS: 'Thừa', UNBOOKED: 'Có thực không sổ', MISSING: 'Có sổ không thực', LOCATION: 'Lệch vị trí',
};
export const COUNT_TYPE_LABEL: Record<string, string> = {
  PERIODIC: 'Định kỳ', EXTRAORDINARY: 'Đột xuất', HANDOVER: 'Bàn giao', POST_EVENT: 'Sau sự kiện',
};

// ---------------- Hooks (đọc) ----------------
export function useCampaigns(status?: string) {
  return useQuery({
    queryKey: ['dt10', 'campaigns', status ?? ''],
    queryFn: async () => (await api.get<Paged<Campaign>>('/count-campaigns', { params: { size: 100, status: status || undefined } })).data,
    placeholderData: keepPreviousData,
  });
}
export function useCampaign(id?: string) {
  return useQuery({ queryKey: ['dt10', 'campaign', id], enabled: !!id, queryFn: async () => (await api.get<Campaign>(`/count-campaigns/${id}`)).data });
}
export function useBookSnapshot(id?: string, enabled = true) {
  return useQuery({ queryKey: ['dt10', 'book', id], enabled: !!id && enabled, retry: false, queryFn: async () => (await api.get<BookSnapshotView>(`/count-campaigns/${id}/book-snapshot`)).data });
}
export function useSheets(id?: string) {
  return useQuery({ queryKey: ['dt10', 'sheets', id], enabled: !!id, queryFn: async () => (await api.get<Sheet[]>(`/count-campaigns/${id}/sheets`)).data });
}
export function useSheetDetail(sheetId?: string) {
  return useQuery({ queryKey: ['dt10', 'sheet', sheetId], enabled: !!sheetId, queryFn: async () => (await api.get<SheetDetail>(`/count-sheets/${sheetId}`)).data });
}
export function useVariances(id?: string) {
  return useQuery({ queryKey: ['dt10', 'variances', id], enabled: !!id, queryFn: async () => (await api.get<Variance[]>(`/count-campaigns/${id}/variances`)).data });
}
export function useOfficial(id?: string, enabled = true) {
  return useQuery({ queryKey: ['dt10', 'official', id], enabled: !!id && enabled, retry: false, queryFn: async () => (await api.get<OfficialView>(`/count-campaigns/${id}/official-snapshot`)).data });
}
export function useAdjustments(id?: string) {
  return useQuery({ queryKey: ['dt10', 'adjustments', id], enabled: !!id, queryFn: async () => (await api.get<Adjustment[]>(`/count-campaigns/${id}/adjustment-requests`)).data });
}
export function useDatasets(id?: string) {
  return useQuery({ queryKey: ['dt10', 'datasets', id], enabled: !!id, queryFn: async () => (await api.get<Dataset[]>(`/count-campaigns/${id}/datasets`)).data });
}
export function useReconciliation(id?: string, enabled = true) {
  return useQuery({ queryKey: ['dt10', 'recon', id], enabled: !!id && enabled, retry: false, queryFn: async () => (await api.get<Reconciliation>(`/count-campaigns/${id}/reconciliation`)).data });
}

// ---------------- Mutations (ghi) ----------------
export const createCampaign = async (body: { campaignCode: string; name: string; countType?: string; scopeJson?: Record<string, unknown> }) =>
  (await api.post<Campaign>('/count-campaigns', body)).data;
export const cutoffCampaign = async (id: string, cutoffTime?: string) => (await api.post(`/count-campaigns/${id}/cutoff`, { cutoffTime })).data;
export const buildBookSnapshot = async (id: string) => (await api.post(`/count-campaigns/${id}/build-book-snapshot`, {})).data;
export const createSheet = async (id: string, body: { organizationId?: string; locationId?: string }) => (await api.post<Sheet>(`/count-campaigns/${id}/sheets`, body)).data;
export const updateSheetLines = async (sheetId: string, lines: Array<{ materialCatalogId: string; lotId?: string; physicalQty: number; note?: string }>) =>
  (await api.put(`/count-sheets/${sheetId}/lines`, { lines })).data;
export const submitSheet = async (sheetId: string) => (await api.post(`/count-sheets/${sheetId}/submit`, {})).data;
export const approveSheet = async (sheetId: string) => (await api.post(`/count-sheets/${sheetId}/approve`, {})).data;
export const recountSheet = async (sheetId: string, reason?: string) => (await api.post(`/count-sheets/${sheetId}/recount`, { reason })).data;
export const saveQuality = async (countLineId: string, grades: { grade1: number; grade2: number; grade3: number; grade4: number; grade5: number }) =>
  (await api.post(`/count-lines/${countLineId}/quality`, grades)).data;
export const computeVariances = async (id: string) => (await api.post<Variance[]>(`/count-campaigns/${id}/variances`, {})).data;
export const resolveVariance = async (varianceId: string, note?: string) => (await api.post(`/variances/${varianceId}/resolve`, { note })).data;
export const createOfficial = async (id: string) => (await api.post(`/count-campaigns/${id}/official-snapshot`, {})).data;
export const lockOfficial = async (id: string) => (await api.post(`/count-campaigns/${id}/lock`, {})).data;
export const unlockOfficial = async (id: string, reason: string) => (await api.post(`/count-campaigns/${id}/unlock`, { reason })).data;
export const reviseOfficial = async (id: string, reason: string) => (await api.post(`/count-campaigns/${id}/revise`, { reason })).data;
export const createAdjustment = async (id: string, varianceId: string) => (await api.post<Adjustment>(`/count-campaigns/${id}/adjustment-requests`, { varianceId })).data;
export const approveAdjustment = async (adjId: string) => (await api.post(`/adjustment-requests/${adjId}/approve`, {})).data;
export const buildDataset = async (id: string, formCode: string) => (await api.post<Dataset>(`/count-campaigns/${id}/datasets`, { formCode })).data;
