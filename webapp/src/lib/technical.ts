import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from './api';

// DT-03 — Hồ sơ kỹ thuật: mẫu sản phẩm, đời thiết kế (revision), độ đầy đủ.

export interface ProductModel {
  id: string;
  modelCodeInternal: string;
  modelName: string;
  designSymbol: string | null;
  designYear: string | null;
  technologyGroup: string | null;
  status: string;
}

export interface DesignRevision {
  id: string;
  productModelId: string;
  revisionCode: string;
  status: string;
  publishedAt: string | null;
  supersedesRevisionId: string | null;
  changeSummary: string | null;
}

export interface Completeness {
  revisionId: string;
  level: string;
  counts: { documents: number; sheets: number; attributes: number; boms: number };
  verifiedAttributes: number;
}

interface Paged<T> { data: T[]; meta: { total: number } }

export const REVISION_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  EXTRACTED: 'Đã trích',
  UNDER_TECHNICAL_REVIEW: 'Đang thẩm định',
  VERIFIED: 'Đã xác minh',
  PUBLISHED: 'Đã công bố',
  SUPERSEDED: 'Đã thay thế',
  ARCHIVED: 'Lưu trữ',
};

// Bước chuyển tiếp hợp lệ (để hiện nút) — khớp REVISION_TRANSITIONS backend.
export const NEXT_REVISION_STATUS: Record<string, string[]> = {
  DRAFT: ['EXTRACTED'],
  EXTRACTED: ['UNDER_TECHNICAL_REVIEW'],
  UNDER_TECHNICAL_REVIEW: ['VERIFIED'],
  VERIFIED: ['PUBLISHED'],
  PUBLISHED: [],
  SUPERSEDED: [],
  ARCHIVED: [],
};

export function useTechnicalModels(search: string) {
  return useQuery({
    queryKey: ['technical', 'models', search],
    queryFn: async () => (await api.get<Paged<ProductModel>>('/technical-models', { params: { size: 100, search: search || undefined } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useRevisions(modelId: string | undefined) {
  return useQuery({
    enabled: !!modelId,
    queryKey: ['technical', 'revisions', modelId],
    queryFn: async () => (await api.get<DesignRevision[]>(`/technical-models/${modelId}/revisions`)).data,
  });
}

export function useCompleteness(revisionId: string | undefined) {
  return useQuery({
    enabled: !!revisionId,
    queryKey: ['technical', 'completeness', revisionId],
    queryFn: async () => (await api.get<Completeness>(`/technical-completeness/${revisionId}`)).data,
  });
}
