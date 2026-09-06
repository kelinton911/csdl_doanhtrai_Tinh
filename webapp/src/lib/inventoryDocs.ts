import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-05 — Chứng từ nhập/xuất/điều chuyển + khóa kỳ.

export interface InventoryDocument {
  id: string;
  documentNo: string;
  documentType: string;
  organizationId: string;
  effectiveDate: string;
  status: string;
  postedAt: string | null;
}

export interface DocumentLine {
  id: string;
  lineNo: number;
  materialCatalogId: string;
  quantity: string;
  movementId: string | null;
}

export interface TransferOrder {
  id: string;
  orderNo: string;
  fromOrg: string;
  toOrg: string;
  materialCatalogId: string;
  dispatchedQty: string | null;
  receivedQty: string | null;
  status: string;
  discrepancyNote: string | null;
}

export interface StockPeriod {
  id: string;
  organizationId: string;
  periodFrom: string;
  periodTo: string;
  status: string;
}

export const DOC_TYPE_LABEL: Record<string, string> = {
  RECEIPT: 'Nhập',
  ISSUE: 'Xuất',
  TRANSFER: 'Điều chuyển',
  RECALL: 'Thu hồi',
  DISPOSAL: 'Thanh lý',
  CONVERSION: 'Chuyển đổi',
};

// Hành động workflow theo trạng thái chứng từ (đường dẫn endpoint + nhãn nút).
export const DOC_ACTIONS: Record<string, Array<{ path: string; label: string; danger?: boolean }>> = {
  DRAFT: [{ path: 'submit', label: 'Gửi' }, { path: 'cancel', label: 'Hủy', danger: true }],
  SUBMITTED: [{ path: 'review', label: 'Thẩm định' }, { path: 'cancel', label: 'Hủy', danger: true }],
  UNDER_REVIEW: [{ path: 'approve', label: 'Duyệt' }],
  APPROVED: [{ path: 'post', label: 'Ghi sổ' }, { path: 'cancel', label: 'Hủy', danger: true }],
  POSTED: [{ path: 'reverse', label: 'Đảo chứng từ', danger: true }],
  REVERSED: [],
  CANCELLED: [],
};

export function useDocuments(status: string, organizationId: string | undefined) {
  return useQuery({
    queryKey: ['dt05', 'documents', status, organizationId],
    queryFn: async () => (await api.get<InventoryDocument[]>('/inventory-documents', { params: { status: status || undefined, organizationId } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useTrace(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ['dt05', 'trace', id],
    queryFn: async () => (await api.get<{ document: InventoryDocument; lines: DocumentLine[]; movements: Array<{ id: string; transactionNo: string; quantitySigned: string; status: string }> }>(`/inventory-documents/${id}/trace`)).data,
  });
}

export function useInTransit() {
  return useQuery({
    queryKey: ['dt05', 'in-transit'],
    queryFn: async () => (await api.get<TransferOrder[]>('/transfer-orders/in-transit')).data,
  });
}

export function usePeriods(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['dt05', 'periods', organizationId],
    queryFn: async () => (await api.get<StockPeriod[]>('/stock-periods', { params: { organizationId } })).data,
  });
}
