import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-11 — Báo cáo & biểu mẫu (Quyển XI). Client gọi /report-definitions, /dataset-*, /report-instances…
// KHÔNG chứa business rule (validate/hash/rollup ở backend).

// ---------------- Kiểu dữ liệu ----------------
export interface ReportDefinition {
  id: string;
  formCode: string;
  title: string;
  category: string | null;
  status: string;
  currentVersionNo: number;
}
export interface TemplateVersion {
  id: string;
  reportDefinitionId: string;
  versionNo: number;
  layoutSchemaJson: { datasetDefinitionCode?: string; columns?: Array<{ key: string; header: string }> };
  status: string;
}
export interface DatasetDefinition {
  id: string;
  code: string;
  title: string;
  sourceType: string;
  status: string;
}
export interface DatasetField {
  id: string;
  fieldKey: string;
  sourcePath: string;
  header: string | null;
  dataType: string;
  orderNo: number;
}
export interface DatasetInstance {
  id: string;
  datasetDefinitionId: string;
  datasetHash: string;
  sourceFingerprint: string;
  status: string;
  rowCount: number;
  generatedAt: string;
  sourceSnapshotRef: Record<string, unknown>;
  payloadJson: { rows?: Array<{ key: string; cells: Record<string, { value: unknown; state: string }> }>; sourceTotals?: Record<string, number> };
}
export interface DatasetValidation {
  id: string;
  checkType: string;
  status: string;
  message: string | null;
}
export interface ReportInstance {
  id: string;
  reportCode: string;
  reportDefinitionId: string;
  datasetInstanceId: string;
  status: string;
  versionNo: number;
  supersededById: string | null;
  checksum: string | null;
  fileFormat: string | null;
  issuedAt: string | null;
}
export interface Lineage {
  id: string;
  cellRef: string;
  datasetField: string | null;
  cellState: string;
  value: string | null;
  snapshotRef: Record<string, unknown>;
  transactionRef: Record<string, unknown>;
}
export interface RollupStatus {
  parentReportId: string;
  children: Array<{ childOrgId: string; childOrgName: string | null; childInstanceId: string | null; submissionStatus: string }>;
  aggregatedTotals: Record<string, number>;
  submittedCount: number;
  missingCount: number;
  missingOrgIds: string[];
}

// ---------------- Nhãn ----------------
export const REPORT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', VALIDATED: 'Đã kiểm tra', APPROVED: 'Đã duyệt', ISSUED: 'Đã phát hành', SUPERSEDED: 'Đã thay thế',
};
export const VALIDATION_STATUS_LABEL: Record<string, string> = { PASS: 'Đạt', WARN: 'Cảnh báo', FAIL: 'Lỗi' };
export const CELL_STATE_LABEL: Record<string, string> = {
  VALUE: 'Có số liệu', ZERO: 'Bằng 0', NO_DATA: 'Chưa có dữ liệu', MISSING_SUBMISSION: 'Chưa gửi',
};

// ---------------- Hooks (đọc) ----------------
export function useDefinitions() {
  return useQuery({
    queryKey: ['dt11', 'definitions'],
    queryFn: async () => (await api.get<ReportDefinition[]>('/report-definitions')).data,
    placeholderData: keepPreviousData,
  });
}
export function useTemplateVersions(defId?: string) {
  return useQuery({ queryKey: ['dt11', 'templates', defId], enabled: !!defId, queryFn: async () => (await api.get<TemplateVersion[]>(`/report-definitions/${defId}/template-versions`)).data });
}
export function useDatasetDefinitions() {
  return useQuery({ queryKey: ['dt11', 'datasets'], queryFn: async () => (await api.get<DatasetDefinition[]>('/dataset-definitions')).data });
}
export function useFields(defId?: string) {
  return useQuery({ queryKey: ['dt11', 'fields', defId], enabled: !!defId, queryFn: async () => (await api.get<DatasetField[]>(`/dataset-definitions/${defId}/fields`)).data });
}
export function useDatasetInstance(id?: string) {
  return useQuery({ queryKey: ['dt11', 'instance', id], enabled: !!id, queryFn: async () => (await api.get<DatasetInstance>(`/dataset-instances/${id}`)).data });
}
export function useDatasetValidations(id?: string) {
  return useQuery({ queryKey: ['dt11', 'validations', id], enabled: !!id, queryFn: async () => (await api.get<DatasetValidation[]>(`/dataset-instances/${id}/validations`)).data });
}
export function useReports() {
  return useQuery({ queryKey: ['dt11', 'reports'], queryFn: async () => (await api.get<ReportInstance[]>('/report-instances')).data, placeholderData: keepPreviousData });
}
export function useLineage(reportId?: string, cell?: string) {
  return useQuery({ queryKey: ['dt11', 'lineage', reportId, cell ?? ''], enabled: !!reportId, queryFn: async () => (await api.get<Lineage[]>(`/report-instances/${reportId}/lineage`, { params: { cell: cell || undefined } })).data });
}
export function useRollupStatus(reportId?: string) {
  return useQuery({ queryKey: ['dt11', 'rollup', reportId], enabled: !!reportId, queryFn: async () => (await api.get<RollupStatus>(`/report-instances/${reportId}/rollup-status`)).data });
}

// ---------------- Mutations (ghi) ----------------
export const createDefinition = async (body: { formCode: string; title: string; category?: string }) =>
  (await api.post<ReportDefinition>('/report-definitions', body)).data;
export const createTemplate = async (defId: string, body: { layoutSchemaJson: Record<string, unknown>; publish?: boolean }) =>
  (await api.post<TemplateVersion>(`/report-definitions/${defId}/template-versions`, body)).data;
export const createDatasetDefinition = async (body: { code: string; title: string; sourceType: string }) =>
  (await api.post<DatasetDefinition>('/dataset-definitions', body)).data;
export const addField = async (defId: string, body: { fieldKey: string; sourcePath: string; header?: string; dataType?: string; orderNo?: number }) =>
  (await api.post(`/dataset-definitions/${defId}/fields`, body)).data;
export const generateDataset = async (body: { datasetDefinitionCode: string; sourceRef: Record<string, unknown>; scopeJson?: Record<string, unknown> }) =>
  (await api.post<DatasetInstance>('/dataset-instances', body)).data;
export const validateDataset = async (id: string) => (await api.post(`/dataset-instances/${id}/validate`, {})).data;
export const createReport = async (body: { formCode: string; datasetInstanceId: string; templateVersionId?: string; scopeJson?: Record<string, unknown> }) =>
  (await api.post<ReportInstance>('/report-instances', body)).data;
export const validateReport = async (id: string) => (await api.post(`/report-instances/${id}/validate`, {})).data;
export const approveReport = async (id: string) => (await api.post(`/report-instances/${id}/approve`, {})).data;
export const issueReport = async (id: string, format = 'pdf') => (await api.post<ReportInstance>(`/report-instances/${id}/issue`, { format })).data;
export const reissueReport = async (id: string, format = 'pdf') => (await api.post<ReportInstance>(`/report-instances/${id}/reissue`, { format })).data;
export const downloadReport = async (id: string) => (await api.get<{ url: string; reportCode: string; checksum: string | null; format: string | null }>(`/report-instances/${id}/download`)).data;
export const rollupReport = async (id: string, children: Array<{ childOrgId: string; childOrgName?: string; childInstanceId?: string; submissionStatus: string }>) =>
  (await api.post<RollupStatus>(`/report-instances/${id}/rollup`, { children })).data;
