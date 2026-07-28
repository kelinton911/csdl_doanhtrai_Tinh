import { useQuery } from '@tanstack/react-query';
import { api } from './api';

interface CatalogItem {
  id: string;
  code: string;
  name: string;
  status: string;
  sortOrder: number;
}

// Nạp một loại danh mục và trả map code→name (dùng để hiển thị nhãn tiếng Việt).
export function useCatalog(type: string) {
  const q = useQuery({
    queryKey: ['catalog', type],
    queryFn: async () =>
      (await api.get(`/master-data/${type}`, { params: { size: 200 } })).data as {
        data: CatalogItem[];
      },
    staleTime: 5 * 60_000,
  });
  const items = q.data?.data ?? [];
  const map = Object.fromEntries(items.map((c) => [c.code, c.name]));
  const label = (code: string | null | undefined) => (code ? map[code] ?? code : '—');
  return { items, label, isLoading: q.isLoading };
}
