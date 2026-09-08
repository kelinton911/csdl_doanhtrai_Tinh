import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-12 — Dashboard chỉ huy (Quyển XII). Client gọi /dt12/*. KHÔNG chứa business rule (semantic/hash/freshness/
// threshold/scoring ở backend). Mọi KPI kèm lineage (AC-15).

// ---------------- Kiểu dữ liệu ----------------
export interface KpiDefinition {
  id: string;
  kpiCode: string;
  name: string;
  semanticRef: string;
  unit: string | null;
  status: string;
}
export interface OverviewKpi {
  kpiCode: string;
  name: string;
  semantic: string;
  unit: string | null;
  value: number | null;
  asOfTime: string | null;
  freshness: string;
  persisted: boolean;
  metricInstanceId?: string;
  lineage: unknown[];
}
export interface CommandOverview {
  generatedAt: string;
  scope: Record<string, unknown>;
  kpis: OverviewKpi[];
}
export interface SemanticItem {
  semantic: string;
  value: number | null;
  sourceAsOf: string | null;
  sourceVersion: string | null;
  freshness: string;
  lineage: unknown[];
}
export interface MetricInstance {
  id: string;
  kpiDefinitionId: string;
  asOfTime: string;
  value: string | null;
  sourceVersion: string | null;
  freshnessStatus: string;
  metricHash: string;
  lineageJson: unknown[];
  latestSourceVersion?: string | null;
}
export interface MetricDrillDown {
  metricInstanceId: string;
  kpiCode: string;
  semantic: string;
  sourceType: string;
  metricValue: number | null;
  drillDownTotal: number;
  rows: Array<{ materialCatalogId: string; organizationId?: string | null; value: number | null; extra?: Record<string, unknown> }>;
}
export interface FreshnessItem {
  factType: string;
  lastRefreshedAt: string | null;
  refreshedVersion: string | null;
  currentVersion: string | null;
  rowCount: number;
  freshness: string;
}
export interface AlertRule {
  id: string;
  ruleCode: string;
  name: string;
  kpiDefinitionId: string;
  warnLevel: string | null;
  criticalLevel: string | null;
  direction: string;
  slaHours: number;
  status: string;
}
export interface AlertInstance {
  id: string;
  ruleId: string;
  kpiDefinitionId: string;
  severity: string;
  status: string;
  value: string | null;
  asOfTime: string;
  dueAt: string | null;
  resolution: string | null;
}
export interface DecisionSessionDetail {
  session: { id: string; sessionCode: string; title: string; status: string; baselineJson: Record<string, unknown>; paramsJson: Record<string, unknown> };
  options: Array<{ id: string; optionKey: string; label: string }>;
  criteria: Array<{ id: string; criterionKey: string; label: string; weight: string; direction: string }>;
  scores: Array<{ optionId: string; criterionId: string; rawValue: string | null; normalized: string | null; weighted: string | null }>;
  records: Array<{ id: string; chosenOptionId: string | null; rationale: string | null; recordedAt: string }>;
}

// ---------------- Nhãn ----------------
export const SEMANTIC_LABEL: Record<string, string> = {
  SEM_HC: 'Hiện có (HC)',
  SEM_HC_AVAILABLE: 'Khả dụng (HC-AVAILABLE)',
  SEM_RESERVE_SSCD: 'Dự trữ SSCĐ',
  SEM_PC_SCD: 'Phân cấp SSCĐ (PC_SSCĐ)',
  SEM_NC: 'Nhu cầu (NC)',
  SEM_SUPPLY_REQUIRED: 'Cần bảo đảm',
  SEM_GAP: 'Thiếu hụt (GAP)',
};
export const FRESHNESS_LABEL: Record<string, string> = { FRESH: 'Mới', STALE: 'Cũ (STALE)', NO_SOURCE: 'Chưa có nguồn' };
export const SEVERITY_LABEL: Record<string, string> = { INFO: 'Thông tin', WARN: 'Cảnh báo', CRITICAL: 'Nghiêm trọng' };
export const ALERT_STATUS_LABEL: Record<string, string> = { OPEN: 'Mở', ACK: 'Đã tiếp nhận', RESOLVED: 'Đã xử lý' };

// ---------------- Hooks (đọc) ----------------
export function useCommandOverview() {
  return useQuery({ queryKey: ['dt12', 'overview'], queryFn: async () => (await api.get<CommandOverview>('/dt12/command-overview')).data, placeholderData: keepPreviousData });
}
export function useSemantics() {
  return useQuery({ queryKey: ['dt12', 'semantics'], queryFn: async () => (await api.get<{ items: SemanticItem[] }>('/dt12/semantics')).data });
}
export function useKpiDefinitions() {
  return useQuery({ queryKey: ['dt12', 'kpis'], queryFn: async () => (await api.get<KpiDefinition[]>('/dt12/kpi-definitions')).data });
}
export function useMetrics(kpiCode?: string) {
  return useQuery({ queryKey: ['dt12', 'metrics', kpiCode ?? ''], queryFn: async () => (await api.get<MetricInstance[]>('/dt12/metrics', { params: { kpi: kpiCode || undefined } })).data, placeholderData: keepPreviousData });
}
export function useMetricDrillDown(id?: string) {
  return useQuery({ queryKey: ['dt12', 'drilldown', id], enabled: !!id, queryFn: async () => (await api.get<MetricDrillDown>(`/dt12/metrics/${id}/drill-down`)).data });
}
export function useMetricLineage(id?: string) {
  return useQuery({ queryKey: ['dt12', 'lineage', id], enabled: !!id, queryFn: async () => (await api.get(`/dt12/metrics/${id}/lineage`)).data });
}
export function useDataMartFreshness() {
  return useQuery({ queryKey: ['dt12', 'freshness'], queryFn: async () => (await api.get<{ items: FreshnessItem[] }>('/dt12/data-mart/freshness')).data });
}
export function useAlerts(status?: string) {
  return useQuery({ queryKey: ['dt12', 'alerts', status ?? ''], queryFn: async () => (await api.get<AlertInstance[]>('/dt12/alerts', { params: { status: status || undefined } })).data, placeholderData: keepPreviousData });
}
export function useAlertRules() {
  return useQuery({ queryKey: ['dt12', 'alert-rules'], queryFn: async () => (await api.get<AlertRule[]>('/dt12/alert-rules')).data });
}
export function useDecisionSession(id?: string) {
  return useQuery({ queryKey: ['dt12', 'session', id], enabled: !!id, queryFn: async () => (await api.get<DecisionSessionDetail>(`/dt12/decision-sessions/${id}`)).data });
}
export function useMapMaterials() {
  return useQuery({ queryKey: ['dt12', 'map'], queryFn: async () => (await api.get<{ snapshot: unknown; items: Array<{ organizationId: string; hc: number }> }>('/dt12/map/materials')).data });
}

// ---------------- Mutations (ghi) ----------------
export const computeMetric = async (body: { kpiCode: string; scopeJson?: Record<string, unknown>; asOf?: string }) =>
  (await api.post<MetricInstance>('/dt12/metrics/compute', body)).data;
export const refreshDataMart = async (factType: string) => (await api.post('/dt12/data-mart/refresh', { factType })).data;
export const evaluateAlerts = async (ruleCode?: string) => (await api.post<{ evaluated: number; created: number }>('/dt12/alerts/evaluate', { ruleCode })).data;
export const ackAlert = async (id: string, note?: string) => (await api.post<AlertInstance>(`/dt12/alerts/${id}/ack`, { note })).data;
export const resolveAlert = async (id: string, resolution: string) => (await api.post<AlertInstance>(`/dt12/alerts/${id}/resolve`, { resolution })).data;
export const assignAlert = async (id: string, assigneeId: string, note?: string) => (await api.post(`/dt12/alerts/${id}/assign`, { assigneeId, note })).data;
export const createSession = async (body: { title: string; scopeJson?: Record<string, unknown>; paramsJson?: Record<string, unknown> }) =>
  (await api.post<{ id: string; sessionCode: string }>('/dt12/decision-sessions', body)).data;
export const addOption = async (id: string, body: { optionKey: string; label: string; paramsJson?: Record<string, unknown> }) =>
  (await api.post(`/dt12/decision-sessions/${id}/options`, body)).data;
export const addCriterion = async (id: string, body: { criterionKey: string; label: string; weight?: number; direction?: string }) =>
  (await api.post(`/dt12/decision-sessions/${id}/criteria`, body)).data;
export const scoreSession = async (id: string, scores: Array<{ optionKey: string; criterionKey: string; rawValue?: number }>) =>
  (await api.post<{ sessionId: string; ranking: Array<{ optionKey?: string; total: number }> }>(`/dt12/decision-sessions/${id}/score`, { scores })).data;
export const recordDecision = async (id: string, body: { chosenOptionKey?: string; rationale?: string }) =>
  (await api.post(`/dt12/decision-sessions/${id}/record`, body)).data;
