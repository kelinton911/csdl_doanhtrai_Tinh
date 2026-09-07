import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-08 — Engine tính nhu cầu NC = TT + PC_SSCĐ − HC (Quyển VIII).
// Client gọi /calculation-scenarios, /runs… (không chứa business rule).

export interface ScenarioMaterial {
  materialCatalogId: string;
  unitId?: string;
  phases?: string[]; // PREPARATION | COMBAT
  scale?: number;
  daysPrep?: number;
  daysCombat?: number;
}

export interface ScenarioScope {
  mission?: string;
  org?: string;
  territory?: string;
  phase?: string;
  quality?: string;
  scale?: string;
  time?: string;
  materials: ScenarioMaterial[];
}

export interface Scenario {
  id: string;
  scenarioCode: string;
  name: string;
  missionId: string | null;
  scopeJson: ScenarioScope;
  effectiveTime: string;
  engineVersion: string;
  revisionNo: number;
  status: string; // DRAFT | CALCULATED | LOCKED | SUPERSEDED
  basedOnId: string | null;
  hcSnapshotId: string | null;
  lockedAt: string | null;
}

export interface CalcRun {
  id: string;
  scenarioId: string;
  runNo: number;
  inputHash: string;
  outputHash: string | null;
  engineVersion: string;
  status: string; // RUNNING | COMPLETED | FAILED
  lineCount: number;
  exceptionCount: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface MaterialCalc {
  id: string;
  runId: string;
  materialCatalogId: string;
  phase: string | null;
  ttGdcb: string | null;
  ttGdcd: string | null;
  tt: string | null;
  pcSscd: string | null;
  hc: string | null;
  nc: string | null;
  supplyRequired: string | null;
  unitId: string | null;
  ruleStatus: string; // SELECTED | NO_RULE | CONFLICT
  hcStatus: string; // OK | NO_HC_SNAPSHOT
}

export interface TraceNode {
  id: string;
  seq: number;
  stepType: string; // NORM | RESERVE | HC | FORMULA
  inputRefs: Record<string, unknown>;
  formula: string | null;
  outputValue: string | null;
  note: string | null;
}

export interface RuleResolution {
  id: string;
  semanticParam: string;
  resolvedNormId: string | null;
  status: string;
  sourceReference: string | null;
  explanationJson: Record<string, unknown>;
}

export interface MaterialTrace {
  calculation: MaterialCalc;
  trace: TraceNode[];
  resolutions: RuleResolution[];
}

export interface ExceptionItem {
  materialCalculationId: string;
  materialCatalogId: string;
  ruleStatus: string;
  hcStatus: string;
  reason: string;
}

export interface SupplyResult {
  runId: string;
  scenarioId: string;
  outputHash: string | null;
  engineVersion: string;
  locked: boolean;
  pendingExceptions: number;
  items: Array<{ materialCatalogId: string; supplyRequired: number; nc: number | null; unitId: string | null }>;
}

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

export interface CompareResult {
  baseRunId: string;
  targetRunId: string;
  changed: number;
  lines: CompareLine[];
}

interface Paged<T> {
  data: T[];
  meta: { page: number; size: number; total: number };
}

// ---- Nhãn tiếng Việt ----
export const RULE_STATUS_LABEL: Record<string, string> = {
  SELECTED: 'Đã chọn định mức',
  NO_RULE: 'Không có định mức (không tính = 0)',
  CONFLICT: 'Xung đột định mức',
};

export const HC_STATUS_LABEL: Record<string, string> = {
  OK: 'HC từ snapshot',
  NO_HC_SNAPSHOT: 'Thiếu snapshot HC',
};

export const SCENARIO_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  CALCULATED: 'Đã tính',
  LOCKED: 'Đã khóa (bàn giao DT-09)',
  SUPERSEDED: 'Đã thay thế',
};

// ---- Hooks (đọc) ----
export function useScenarios() {
  return useQuery({
    queryKey: ['dt08', 'scenarios'],
    queryFn: async () => (await api.get<Paged<Scenario>>('/calculation-scenarios', { params: { size: 100 } })).data,
  });
}

export function useScenario(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['dt08', 'scenario', id],
    queryFn: async () => (await api.get<Scenario>(`/calculation-scenarios/${id}`)).data,
  });
}

export function useScenarioRuns(scenarioId: string | undefined) {
  return useQuery({
    enabled: !!scenarioId,
    queryKey: ['dt08', 'runs', scenarioId],
    queryFn: async () => (await api.get<CalcRun[]>(`/calculation-scenarios/${scenarioId}/runs`)).data,
    placeholderData: keepPreviousData,
  });
}

export function useRunMaterials(runId: string | undefined) {
  return useQuery({
    enabled: !!runId,
    queryKey: ['dt08', 'materials', runId],
    queryFn: async () => (await api.get<MaterialCalc[]>(`/runs/${runId}/materials`)).data,
    placeholderData: keepPreviousData,
  });
}

export function useRunExceptions(runId: string | undefined) {
  return useQuery({
    enabled: !!runId,
    queryKey: ['dt08', 'exceptions', runId],
    queryFn: async () => (await api.get<ExceptionItem[]>(`/runs/${runId}/exceptions`)).data,
  });
}

export function useRunSupply(runId: string | undefined) {
  return useQuery({
    enabled: !!runId,
    queryKey: ['dt08', 'supply', runId],
    queryFn: async () => (await api.get<SupplyResult>(`/runs/${runId}/supply-required`)).data,
  });
}

export function useMaterialTrace(runId: string | undefined, materialCalcId: string | undefined) {
  return useQuery({
    enabled: !!runId && !!materialCalcId,
    queryKey: ['dt08', 'trace', runId, materialCalcId],
    queryFn: async () => (await api.get<MaterialTrace>(`/runs/${runId}/materials/${materialCalcId}/trace`)).data,
  });
}

// ---- Actions (ghi) ----
export interface CreateScenarioBody {
  scenarioCode?: string;
  name: string;
  effectiveTime?: string;
  hcSnapshotId?: string;
  scope: ScenarioScope;
}

export async function createScenario(body: CreateScenarioBody) {
  return (await api.post<Scenario>('/calculation-scenarios', body)).data;
}

export async function runScenario(id: string) {
  return (await api.post<CalcRun>(`/calculation-scenarios/${id}/run`, {})).data;
}

export async function lockScenario(id: string) {
  return (await api.post<Scenario>(`/calculation-scenarios/${id}/lock`, {})).data;
}

export async function reviseScenario(id: string, body: Partial<CreateScenarioBody>) {
  return (await api.post<Scenario>(`/calculation-scenarios/${id}/revise`, body)).data;
}

export async function compareRuns(base: string, target: string): Promise<CompareResult> {
  return (await api.get<CompareResult>('/runs/compare', { params: { base, target } })).data;
}
