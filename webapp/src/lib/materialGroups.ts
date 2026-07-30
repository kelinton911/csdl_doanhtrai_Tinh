import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// Nút cây nhóm vật chất (khớp MaterialGroupService.tree ở backend).
export interface GroupNode {
  id: string;
  code: string;
  name: string;
  ordinal: string | null;
  origin: 'BQP' | 'STANDARD' | 'LOCAL' | string;
  userEdited: boolean;
  parentCode: string | null;
  sortOrder: number;
  status: string;
  description: string | null;
  materialCount: number; // vật chất trực thuộc trực tiếp
  totalMaterialCount: number; // gộp cả nhánh con
  childCount: number;
  children: GroupNode[];
}

export const ORIGIN_LABEL: Record<string, string> = {
  BQP: 'BQP',
  STANDARD: 'Ngành',
  LOCAL: 'Cục bộ',
};

// Duyệt cây theo thứ tự hiển thị (cha trước con) → mảng phẳng kèm độ sâu.
export function flattenTree(nodes: GroupNode[], depth = 0): Array<{ node: GroupNode; depth: number }> {
  const out: Array<{ node: GroupNode; depth: number }> = [];
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children.length) out.push(...flattenTree(node.children, depth + 1));
  }
  return out;
}

export function useMaterialGroupTree() {
  return useQuery({
    queryKey: ['material-groups'],
    queryFn: async () => (await api.get('/material-groups')).data as GroupNode[],
  });
}
