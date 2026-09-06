// Enum trạng thái CHUẨN dùng chung toàn hệ thống (Sprint 0 §3 — 02-QUY-UOC-CHUNG.md).
// Khai báo tập trung + kiểm tra transition; KHÔNG hard-code chuỗi rời rạc trong service.
// Các enum vòng đời riêng của module cũ vẫn ở `common/workflow.ts` (giữ tương thích);
// module MỚI (DT-01..DT-12) dùng các enum tại đây làm nguồn chuẩn.

// Danh mục / phiên bản danh mục (DT-01).
export enum CatalogVersionStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

// Chứng từ giao dịch (DT-05). Nhánh phụ: RETURNED, REJECTED, CANCELLED.
export enum DocumentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED',
  RETURNED = 'RETURNED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

// Phương án/scenario tính toán (DT-08).
export enum CalculationScenarioStatus {
  DRAFT = 'DRAFT',
  VALIDATING = 'VALIDATING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  CALCULATED = 'CALCULATED',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  LOCKED = 'LOCKED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

// Xác minh dữ liệu (DT-03, DT-09).
export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PARTIAL = 'PARTIAL',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

// Vòng đời cảnh báo (DT-12). Có thể ESCALATED tại bất kỳ trạng thái mở nào.
export enum AlertLifecycleStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  ESCALATED = 'ESCALATED',
}

// Cấp chất lượng vật chất C1..C5 (DT-04).
export enum QualityGrade {
  C1 = 'C1',
  C2 = 'C2',
  C3 = 'C3',
  C4 = 'C4',
  C5 = 'C5',
}

// Bảng chuyển trạng thái hợp lệ (state machine). Dùng cho `assertTransition`.
export const CATALOG_VERSION_TRANSITIONS: Record<CatalogVersionStatus, CatalogVersionStatus[]> = {
  [CatalogVersionStatus.DRAFT]: [CatalogVersionStatus.VALIDATED, CatalogVersionStatus.ARCHIVED],
  [CatalogVersionStatus.VALIDATED]: [
    CatalogVersionStatus.PUBLISHED,
    CatalogVersionStatus.DRAFT,
    CatalogVersionStatus.ARCHIVED,
  ],
  [CatalogVersionStatus.PUBLISHED]: [CatalogVersionStatus.SUPERSEDED, CatalogVersionStatus.ARCHIVED],
  [CatalogVersionStatus.SUPERSEDED]: [CatalogVersionStatus.ARCHIVED],
  [CatalogVersionStatus.ARCHIVED]: [],
};

export const DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  [DocumentStatus.DRAFT]: [DocumentStatus.SUBMITTED, DocumentStatus.CANCELLED],
  [DocumentStatus.SUBMITTED]: [
    DocumentStatus.UNDER_REVIEW,
    DocumentStatus.RETURNED,
    DocumentStatus.CANCELLED,
  ],
  [DocumentStatus.UNDER_REVIEW]: [
    DocumentStatus.APPROVED,
    DocumentStatus.RETURNED,
    DocumentStatus.REJECTED,
  ],
  [DocumentStatus.APPROVED]: [DocumentStatus.POSTED, DocumentStatus.CANCELLED],
  [DocumentStatus.POSTED]: [DocumentStatus.REVERSED],
  [DocumentStatus.REVERSED]: [],
  [DocumentStatus.RETURNED]: [DocumentStatus.SUBMITTED, DocumentStatus.CANCELLED],
  [DocumentStatus.REJECTED]: [],
  [DocumentStatus.CANCELLED]: [],
};

export const VERIFICATION_TRANSITIONS: Record<VerificationStatus, VerificationStatus[]> = {
  [VerificationStatus.UNVERIFIED]: [
    VerificationStatus.PARTIAL,
    VerificationStatus.VERIFIED,
    VerificationStatus.REJECTED,
  ],
  [VerificationStatus.PARTIAL]: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED],
  [VerificationStatus.VERIFIED]: [VerificationStatus.EXPIRED, VerificationStatus.REJECTED],
  [VerificationStatus.EXPIRED]: [VerificationStatus.UNVERIFIED],
  [VerificationStatus.REJECTED]: [VerificationStatus.UNVERIFIED],
};
