import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI (Phụ lục CV 2837/DT-QLDT ngày 16/7/2026).
//
// KHÔNG dùng lại `useCatalog` trong lib/catalogs.ts: hook đó cứng `size: 200` và nạp
// cả loại danh mục vào một map code→name. Với 1272 mã nó sẽ âm thầm hiển thị 200 dòng
// và coi như đã đủ. Danh mục này luôn duyệt theo cây/tìm kiếm phía máy chủ.

export interface AssetNode {
  id: string;
  code: string;
  name: string;
  parentCode: string | null;
  level: number;
  path: string;
  /** Đường dẫn tên từ gốc — BẮT BUỘC hiển thị: 121 dòng tên đúng bằng "Các loại khác". */
  pathNames: string;
  isLeaf: boolean;
  childCount: number;
  unitRaw: string | null;
  unitCode: string | null;
  /** Nút vừa có ĐVT vừa có con — cảnh báo nguy cơ cộng trùng khi tổng hợp. */
  unitOnGroup: boolean;
  chapter: string | null;
  chapterName: string | null;
  domain: 'FACILITY' | 'MATERIAL' | 'ROOT' | 'UNCLASSIFIED';
  /** Khác rỗng = tên này còn xuất hiện ở chương khác; cần xem kỹ đường dẫn trước khi chọn. */
  duplicateGroup: string | null;
}

export interface AssetChapter {
  chapter: string;
  chapterName: string;
  domain: string;
  rootCode: string;
  itemCount: number;
}

export interface AssetMeta {
  loaded: boolean;
  message?: string;
  revision: string;
  sourceDoc: string;
  sourceSha: string;
  total: number;
  leafCount: number;
  groupCount: number;
  unitOnGroupCount: number;
  duplicateGroupCount: number;
  levelHistogram: Record<string, number>;
  domains: Record<string, number>;
  chapters: AssetChapter[];
}

export interface Paged<T> {
  data: T[];
  meta: { page: number; size: number; total: number };
}

export type AssetDomain = 'FACILITY' | 'MATERIAL';

// Dữ liệu tham chiếu BẤT BIẾN trong suốt phiên (chỉ đổi khi nạp phụ lục mới),
// nên không cần refetch — staleTime: Infinity.
const IMMUTABLE = { staleTime: Infinity, gcTime: 30 * 60_000 } as const;

export function useAssetMeta() {
  return useQuery({
    queryKey: ['asset-catalog', 'meta'],
    queryFn: async () => (await api.get('/asset-catalog/meta')).data as AssetMeta,
    ...IMMUTABLE,
  });
}

/** Con trực tiếp của một nút. `parent` rỗng = nút gốc. `enabled` để tải lười theo nhánh. */
export function useAssetChildren(
  parent: string | null,
  opts: { domain?: AssetDomain; leafOnly?: boolean; enabled?: boolean } = {},
) {
  const { domain, leafOnly, enabled = true } = opts;
  return useQuery({
    queryKey: ['asset-catalog', 'children', parent ?? 'ROOT', domain ?? '', leafOnly ?? false],
    queryFn: async () =>
      (
        await api.get('/asset-catalog/tree', {
          params: {
            ...(parent ? { parent } : {}),
            ...(domain ? { domain } : {}),
            ...(leafOnly ? { leafOnly: 'true' } : {}),
          },
        })
      ).data as { data: AssetNode[]; hasMore: boolean },
    enabled,
    ...IMMUTABLE,
  });
}

export interface AssetSearchParams {
  q?: string;
  domain?: AssetDomain;
  chapter?: string;
  leafOnly?: boolean;
  duplicatesOnly?: boolean;
  page?: number;
  size?: number;
}

export function useAssetSearch(p: AssetSearchParams, enabled = true) {
  return useQuery({
    queryKey: ['asset-catalog', 'search', p],
    queryFn: async () =>
      (
        await api.get('/asset-catalog/search', {
          params: {
            ...(p.q ? { q: p.q } : {}),
            ...(p.domain ? { domain: p.domain } : {}),
            ...(p.chapter ? { chapter: p.chapter } : {}),
            ...(p.leafOnly ? { leafOnly: 'true' } : {}),
            ...(p.duplicatesOnly ? { duplicatesOnly: 'true' } : {}),
            page: p.page ?? 1,
            size: p.size ?? 20,
          },
        })
      ).data as Paged<AssetNode>,
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
}

/** Chi tiết một mã + tổ tiên (breadcrumb) + con trực tiếp. */
export function useAssetDetail(code: string | null) {
  return useQuery({
    queryKey: ['asset-catalog', 'detail', code],
    queryFn: async () =>
      (await api.get(`/asset-catalog/${code}`)).data as {
        item: AssetNode;
        ancestors: AssetNode[];
        children: AssetNode[];
      },
    enabled: !!code,
    ...IMMUTABLE,
  });
}

export interface GapRow {
  id: string;
  code: string;
  name: string;
  assetCode: string | null;
  assetCodeStatus: string;
}

export function useAssetGaps(p: {
  kind: 'material' | 'facility';
  status?: string;
  search?: string;
  page?: number;
  size?: number;
}) {
  return useQuery({
    queryKey: ['asset-catalog', 'gaps', p],
    queryFn: async () =>
      (
        await api.get('/asset-catalog/gaps', {
          params: {
            kind: p.kind,
            status: p.status ?? 'UNMAPPED',
            ...(p.search ? { search: p.search } : {}),
            page: p.page ?? 1,
            size: p.size ?? 20,
          },
        })
      ).data as Paged<GapRow>,
    placeholderData: (prev) => prev,
  });
}

/** Gắn/gỡ mã quốc gia cho vật chất hoặc công trình. */
export async function setAssetCode(
  kind: 'material' | 'facility',
  id: string,
  body: { assetCode?: string | null; status?: string },
) {
  const path = kind === 'material' ? 'materials' : 'facilities';
  return (await api.patch(`/asset-catalog/${path}/${id}/asset-code`, body)).data;
}

/** Bỏ tiền tố đánh mục ("1/", "2.4/", "a/", "-") để hiển thị gọn. Dữ liệu gốc giữ nguyên. */
export function displayName(name: string): string {
  return name.replace(/^\s*-?\s*([IVX]+|\d+(\.\d+)?|[a-z])\s*\/\s*/i, '').trim() || name;
}

/** Đường dẫn tổ tiên bỏ nút gốc "Doanh trại" cho gọn breadcrumb. */
export function shortPath(pathNames: string): string {
  const parts = pathNames.split(' › ');
  return parts.length > 1 ? parts.slice(1, -1).join(' › ') : '';
}
