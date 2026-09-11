import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// Khai báo vật chất (cấp xã / đơn vị trực thuộc Tỉnh) — client gọi /material-declarations/*.

export interface DeclarationLine {
  id: string;
  declarationId: string;
  materialCatalogId: string;
  aliasUsed: string | null;
  unitId: string | null;
  reservePurpose: string;
  quantity: string;
  qtyGrade1: string;
  qtyGrade2: string;
  qtyGrade3: string;
  qtyGrade4: string;
  qtyGrade5: string;
  unitPrice: string | null;
  note: string | null;
  sortOrder: number;
}

export interface Declaration {
  id: string;
  code: string;
  title: string;
  organizationId: string | null;
  areaId: string | null;
  storageLocationId: string | null;
  periodLabel: string | null;
  workflowStatus: string;
  note: string | null;
  lockedAt: string | null;
  updatedAt: string;
  createdBy: string | null;
}

export type DeclarationDetail = Declaration & { lines: DeclarationLine[] };

export interface AmendmentRequest {
  id: string;
  requestCode: string;
  declarationId: string;
  organizationId: string | null;
  requestedChanges: string;
  reason: string;
  evidenceDocumentIds: string[];
  status: string;
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export const RESERVE_PURPOSE_LABEL: Record<string, string> = {
  THUONG_XUYEN: 'Thường xuyên',
  SSCD: 'Sẵn sàng chiến đấu',
  DOT_XUAT: 'Đột xuất',
  GOI_DAU: 'Gối đầu',
  THU_HOI_XU_LY: 'Thu hồi/xử lý',
  CHAM_LUAN_CHUYEN: 'Chậm luân chuyển',
};

export function useDeclarations() {
  return useQuery({
    queryKey: ['material-declarations'],
    queryFn: async () => (await api.get<Declaration[]>('/material-declarations')).data,
    placeholderData: keepPreviousData,
  });
}

export function useDeclaration(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['material-declarations', id],
    queryFn: async () => (await api.get<DeclarationDetail>(`/material-declarations/${id}`)).data,
  });
}

export function useAmendments(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['material-declarations', id, 'amendments'],
    queryFn: async () =>
      (await api.get<AmendmentRequest[]>(`/material-declarations/${id}/amendment-requests`)).data,
  });
}
