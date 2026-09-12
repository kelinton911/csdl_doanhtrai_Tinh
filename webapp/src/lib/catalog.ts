import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-01 — Danh mục chuẩn ngành. Client gọi API /catalog/* (không chứa business rule).

export interface CatalogVersion {
  id: string;
  versionCode: string;
  versionName: string;
  status: string; // DRAFT | VALIDATED | PUBLISHED | SUPERSEDED | ARCHIVED
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface CatalogItem {
  id: string;
  versionId: string;
  code: string;
  name: string;
  parentId: string | null;
  levelNo: number;
  unitId: string | null;
  isLeaf: boolean;
  status: string;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  unitType: string;
}

export interface MaterialAlias {
  id: string;
  materialCatalogId: string;
  aliasName: string;
  aliasType: string;
  status: string;
}

export interface ChangeRequest {
  id: string;
  requestCode: string;
  proposedName: string;
  requestType: string;
  status: string;
  organizationId: string | null;
  createdAt: string;
}

export interface TemporaryMaterial {
  id: string;
  temporaryCode: string;
  displayName: string;
  status: string;
  officialMaterialId: string | null;
  createdAt: string;
}

export interface ImportError {
  id: string;
  rowNo: number;
  fieldName: string | null;
  errorCode: string;
  errorMessage: string;
  rawValue: string | null;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  fileHash: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  status: string;
}

export interface VersionDiff {
  added: string[];
  removed: string[];
  renamed: Array<{ code: string; from: string; to: string }>;
  unitChanged: Array<{ code: string; from: string | null; to: string | null }>;
  parentChanged: Array<{ code: string; from: string | null; to: string | null }>;
}

interface Paged<T> {
  data: T[];
  meta: { page: number; size: number; total: number };
}

// ---- Nhãn tiếng Việt ----
export const VERSION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  VALIDATED: 'Đã kiểm tra',
  PUBLISHED: 'Đã công bố',
  SUPERSEDED: 'Đã thay thế',
  ARCHIVED: 'Lưu trữ',
};

export const CHANGE_REQUEST_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  SUBMITTED: 'Đã gửi',
  UNDER_REVIEW: 'Đang duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  MAPPED: 'Đã ánh xạ',
};

// ---- Hooks ----
export function useCatalogVersions() {
  return useQuery({
    queryKey: ['catalog', 'versions'],
    queryFn: async () => (await api.get<Paged<CatalogVersion>>('/catalog/versions', { params: { size: 100 } })).data,
  });
}

export function useCatalogItems(versionId: string | undefined) {
  return useQuery({
    enabled: !!versionId,
    queryKey: ['catalog', 'items', versionId],
    queryFn: async () =>
      (await api.get<Paged<CatalogItem>>('/catalog/items', { params: { versionId, size: 500 } })).data,
    placeholderData: keepPreviousData,
  });
}

// Nút gốc của một phiên bản (parent_id IS NULL) — điểm vào cho picker duyệt cây.
export function useCatalogRoots(versionId: string | undefined) {
  return useQuery({
    enabled: !!versionId,
    queryKey: ['catalog', 'roots', versionId],
    queryFn: async () =>
      (await api.get<Paged<CatalogItem>>('/catalog/items', { params: { versionId, rootsOnly: true, size: 200 } })).data.data,
  });
}

// Con trực tiếp của một nút (trả tất cả, không phân trang) — dùng để thu hẹp dần.
export function useCatalogChildren(parentId: string | undefined) {
  return useQuery({
    enabled: !!parentId,
    queryKey: ['catalog', 'children', parentId],
    queryFn: async () => (await api.get<CatalogItem[]>(`/catalog/items/${parentId}/children`)).data,
  });
}

export function useCatalogItem(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['catalog', 'item', id],
    queryFn: async () => (await api.get<CatalogItem>(`/catalog/items/${id}`)).data,
  });
}

export function useReplacementWarning(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['catalog', 'replacement', id],
    queryFn: async () =>
      (await api.get<{ replaced: boolean; newMaterialId?: string; newCode?: string }>(`/catalog/items/${id}/replacement`)).data,
  });
}

export function useItemAliases(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['catalog', 'item-aliases', id],
    queryFn: async () => (await api.get<MaterialAlias[]>(`/catalog/items/${id}/aliases`)).data,
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ['catalog', 'units'],
    queryFn: async () => (await api.get<Paged<UnitOfMeasure>>('/catalog/units', { params: { size: 200 } })).data,
  });
}

export function useCompareVersions(from: string | undefined, to: string | undefined) {
  return useQuery({
    enabled: !!from && !!to && from !== to,
    queryKey: ['catalog', 'compare', from, to],
    queryFn: async () => (await api.get<VersionDiff>('/catalog/versions/compare', { params: { from, to } })).data,
  });
}

export function useChangeRequests(status?: string) {
  return useQuery({
    queryKey: ['catalog', 'change-requests', status ?? 'all'],
    queryFn: async () =>
      (await api.get<Paged<ChangeRequest>>('/catalog/change-requests', { params: { size: 100, status } })).data,
  });
}

export function useTemporaries(status?: string) {
  return useQuery({
    queryKey: ['catalog', 'temporaries', status ?? 'all'],
    queryFn: async () =>
      (await api.get<Paged<TemporaryMaterial>>('/catalog/temporary-materials', { params: { size: 100, status } })).data,
  });
}

// Tra mã chuẩn từ alias/mã/tên (bắt buộc trước khi đề nghị — SCR-DT01-04).
export async function resolveAlias(q: string) {
  return (await api.get<{ query: string; normalized: string; matches: CatalogItem[] }>('/catalog/aliases/resolve', { params: { q } })).data;
}
export async function searchCatalog(q: string) {
  return (await api.get<{ items: CatalogItem[]; aliases: MaterialAlias[] }>('/catalog/search', { params: { q } })).data;
}

// Dựng cây từ danh sách phẳng (parentId → children).
export interface CatalogTreeNode extends CatalogItem {
  children: CatalogTreeNode[];
}
export function buildTree(items: CatalogItem[]): CatalogTreeNode[] {
  const byId = new Map<string, CatalogTreeNode>();
  items.forEach((i) => byId.set(i.id, { ...i, children: [] }));
  const roots: CatalogTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else roots.push(node);
  }
  const sortRec = (ns: CatalogTreeNode[]) => {
    ns.sort((a, b) => a.code.localeCompare(b.code));
    ns.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
