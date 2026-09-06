import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// DT-02 — Hồ sơ đất: địa chỉ lịch sử, phân bổ hiện trạng, biến động, diện tích tại snapshot.

export interface LandParcel {
  id: string;
  code?: string;
  name?: string;
  landArea?: string | number;
}

export interface LandAllocation {
  id: string;
  landPointId: string;
  usageType: string;
  areaM2: string;
  status: string;
  effectiveFrom: string | null;
}

export interface LandChange {
  id: string;
  landPointId: string;
  changeType: string;
  areaDeltaM2: string;
  pointDelta: number;
  effectiveDate: string;
  reason: string | null;
}

export const USAGE_TYPE_LABEL: Record<string, string> = {
  BUILDING_LAND: 'Đất xây dựng',
  TRAINING_GROUND: 'Thao trường/bãi tập',
  ECONOMIC: 'Kết hợp kinh tế',
  RESERVE: 'Dự trữ',
  FAMILY: 'Khu gia đình',
  OTHER: 'Khác',
};

export const CHANGE_TYPE_LABEL: Record<string, string> = {
  INCREASE: 'Tăng',
  DECREASE: 'Giảm',
  HANDOVER: 'Bàn giao',
  PURPOSE_CHANGE: 'Chuyển mục đích',
  LEGAL_UPDATE: 'Cập nhật pháp lý',
};

// Danh sách điểm đất (tái dùng endpoint land-parcels; chuẩn hóa shape mảng/paginated).
export function useLandParcels() {
  return useQuery({
    queryKey: ['land-parcels', 'for-dt02'],
    queryFn: async () => {
      const res = await api.get('/land-parcels', { params: { size: 200 } });
      const body = res.data as unknown;
      const list = Array.isArray(body) ? body : ((body as { data?: LandParcel[] }).data ?? []);
      return list as LandParcel[];
    },
  });
}

export function useAllocations(landPointId: string | undefined) {
  return useQuery({
    enabled: !!landPointId,
    queryKey: ['dt02', 'allocations', landPointId],
    queryFn: async () => (await api.get<LandAllocation[]>(`/dt02/land-points/${landPointId}/usage`)).data,
  });
}

export function useChanges(landPointId: string | undefined) {
  return useQuery({
    enabled: !!landPointId,
    queryKey: ['dt02', 'changes', landPointId],
    queryFn: async () => (await api.get<LandChange[]>(`/dt02/land-points/${landPointId}/changes`)).data,
  });
}

export function useDataQuality() {
  return useQuery({
    queryKey: ['dt02', 'data-quality'],
    queryFn: async () =>
      (await api.get<{ checkedAt: string; issueCount: number; issues: Array<{ code: string; landPointId: string; detail: string }> }>('/dt02/data-quality')).data,
  });
}

export async function fetchAreaAtSnapshot(landPointId: string, asOf: string) {
  return (await api.get<{ landPointId: string; asOf: string; baseAreaM2: number; areaAtSnapshotM2: number }>(`/dt02/land-points/${landPointId}/area`, { params: { as_of: asOf } })).data;
}
