// Enum cục bộ DT-03 (Quyển III).

// Máy trạng thái revision hồ sơ kỹ thuật.
export enum RevisionStatus {
  DRAFT = 'DRAFT',
  EXTRACTED = 'EXTRACTED', // OCR/trích tự động (DRAFT_EXTRACTED)
  UNDER_TECHNICAL_REVIEW = 'UNDER_TECHNICAL_REVIEW',
  VERIFIED = 'VERIFIED',
  PUBLISHED = 'PUBLISHED',
  SUPERSEDED = 'SUPERSEDED',
  ARCHIVED = 'ARCHIVED',
}

export enum ModelStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  RETIRED = 'RETIRED',
}

export enum CatalogLinkType {
  PRIMARY = 'PRIMARY',
  ALTERNATE = 'ALTERNATE',
}

export enum TechDocumentType {
  DRAWING_SET = 'DRAWING_SET',
  SPEC = 'SPEC',
  MANUAL = 'MANUAL',
  APPROVAL = 'APPROVAL',
  OTHER = 'OTHER',
}

// Trạng thái xác minh dữ liệu trích (BR-DT03-006): chỉ VERIFIED mới dùng chính thức.
export enum TechVerificationStatus {
  DRAFT_EXTRACTED = 'DRAFT_EXTRACTED',
  NEEDS_VERIFICATION = 'NEEDS_VERIFICATION',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum BomItemStatus {
  MAPPED = 'MAPPED',
  UNMAPPED = 'UNMAPPED',
}

export enum ModelRelationshipType {
  REPLACES = 'REPLACES', // thay thế (2016 ↔ K24)
  EQUIVALENT = 'EQUIVALENT', // tương đương
}

// Độ đầy đủ hồ sơ kỹ thuật.
export enum CompletenessLevel {
  INCOMPLETE = 'INCOMPLETE',
  PARTIAL = 'PARTIAL',
  COMPLETE_VERIFIED = 'COMPLETE_VERIFIED',
}

// Bảng chuyển trạng thái revision.
export const REVISION_TRANSITIONS: Record<RevisionStatus, RevisionStatus[]> = {
  [RevisionStatus.DRAFT]: [RevisionStatus.EXTRACTED, RevisionStatus.ARCHIVED],
  [RevisionStatus.EXTRACTED]: [RevisionStatus.UNDER_TECHNICAL_REVIEW, RevisionStatus.ARCHIVED],
  [RevisionStatus.UNDER_TECHNICAL_REVIEW]: [
    RevisionStatus.VERIFIED,
    RevisionStatus.EXTRACTED,
    RevisionStatus.ARCHIVED,
  ],
  [RevisionStatus.VERIFIED]: [RevisionStatus.PUBLISHED, RevisionStatus.ARCHIVED],
  [RevisionStatus.PUBLISHED]: [RevisionStatus.SUPERSEDED, RevisionStatus.ARCHIVED],
  [RevisionStatus.SUPERSEDED]: [RevisionStatus.ARCHIVED],
  [RevisionStatus.ARCHIVED]: [],
};
