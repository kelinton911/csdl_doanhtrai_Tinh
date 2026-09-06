import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-04 — Thực lực vật chất: HC theo thời điểm + sổ cái giao dịch.

export interface Movement {
  id: string;
  transactionNo: string;
  transactionType: string;
  materialCatalogId: string;
  quantity: string;
  quantitySigned: string;
  organizationId: string;
  effectiveTime: string;
  postedAt: string | null;
  status: string;
}

export interface HcResult {
  data: { materialCatalogId: string; hc: number };
  meta: { as_of_time: string; source: string; locked: boolean; scope: Record<string, unknown> };
}

export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  OPENING: 'Số dư đầu kỳ',
  RECEIPT: 'Tiếp nhận',
  ISSUE: 'Xuất',
  TRANSFER_IN: 'Điều chuyển đến',
  TRANSFER_OUT: 'Điều chuyển đi',
  ADJUSTMENT: 'Điều chỉnh',
};

export const NEXT_MOVEMENT_STATUS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED'],
  APPROVED: ['POSTED'],
  POSTED: ['REVERSED'],
  REVERSED: [],
  CANCELLED: [],
};

export function useMovements(materialCatalogId: string | undefined, organizationId: string | undefined) {
  return useQuery({
    queryKey: ['materiel', 'movements', materialCatalogId, organizationId],
    queryFn: async () =>
      (await api.get<Movement[]>('/materiel/movements', { params: { materialCatalogId, organizationId } })).data,
    placeholderData: keepPreviousData,
  });
}

export async function fetchHc(materialCatalogId: string, asOf: string, organizationId?: string) {
  return (await api.get<HcResult>('/materiel/hc', { params: { materialCatalogId, as_of_time: asOf, organizationId } })).data;
}
