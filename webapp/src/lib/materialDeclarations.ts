import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// Khai báo vật chất (cấp xã / đơn vị trực thuộc Tỉnh) — client gọi /material-declarations/*.

export interface DeclarationLine {
  id: string;
  declarationId: string;
  materialCatalogId: string;
  // Mã/tên CHUẨN từ material_catalog (backend bơm kèm khi GET chi tiết) — để hiển thị
  // tách bạch với "tên gọi khác" (aliasUsed) do xã tự đặt.
  materialCode?: string | null;
  materialName?: string | null;
  aliasUsed: string | null;
  unitId: string | null;
  reservePurpose: string;
  quantity: string;
  // Biến động kỳ (02/KK)
  openingQty: string;
  increaseQty: string;
  decreaseQty: string;
  closingQty: string;
  // Tách vị trí tồn
  inUseQty: string;
  ministryStoreQty: string;
  unitStoreQty: string;
  // Giá trị (1000đ) + quy trọng lượng
  openingValue: string | null;
  increaseValue: string | null;
  decreaseValue: string | null;
  closingValue: string | null;
  convertedWeight: string | null;
  qtyGrade1: string;
  qtyGrade2: string;
  qtyGrade3: string;
  qtyGrade4: string;
  qtyGrade5: string;
  unitPrice: string | null;
  note: string | null;
  sortOrder: number;
}

export interface LineWarning {
  lineId: string;
  messages: string[];
}

export interface Declaration {
  id: string;
  code: string;
  title: string;
  organizationId: string | null;
  areaId: string | null;
  storageLocationId: string | null;
  barracksId: string | null;
  periodLabel: string | null;
  workflowStatus: string;
  note: string | null;
  lockedAt: string | null;
  updatedAt: string;
  createdBy: string | null;
}

export type DeclarationDetail = Declaration & { lines: DeclarationLine[]; warnings?: LineWarning[] };

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

export function useDeclarations(barracksId?: string) {
  return useQuery({
    queryKey: ['material-declarations', barracksId ?? 'all'],
    queryFn: async () =>
      (await api.get<Declaration[]>('/material-declarations', { params: barracksId ? { barracksId } : undefined })).data,
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
