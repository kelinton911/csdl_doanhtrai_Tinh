// Từ điển trạng thái workflow cốt lõi (Hồ sơ TKKT §5.3).
export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  LOCKED = 'LOCKED',
  ARCHIVED = 'ARCHIVED',
}

// Trạng thái cho phép chỉnh sửa trực tiếp bản ghi (chưa chốt).
export const EDITABLE_STATUSES: WorkflowStatus[] = [
  WorkflowStatus.DRAFT,
  WorkflowStatus.CHANGES_REQUESTED,
];

// Chuỗi trạng thái hồ sơ dữ liệu tổng quát (Tài liệu Backend §5).
export enum RecordStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  NEEDS_REVISION = 'NEEDS_REVISION',
  APPROVED = 'APPROVED',
  LOCKED = 'LOCKED',
  ARCHIVED = 'ARCHIVED',
}

// Đợt kiểm kê: PLANNED → OPEN → IN_PROGRESS → SUBMITTED → RECONCILED → CLOSED.
export enum InspectionStatus {
  PLANNED = 'PLANNED',
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  RECONCILED = 'RECONCILED',
  CLOSED = 'CLOSED',
}

// Phiếu kiểm kê: DRAFT → SUBMITTED → APPROVED/NEEDS_REVISION.
export enum SheetStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  NEEDS_REVISION = 'NEEDS_REVISION',
}

// Yêu cầu sửa chữa: DRAFT → PROPOSED → APPROVED → IN_PROGRESS → ACCEPTED → CLOSED.
export enum MaintenanceStatus {
  DRAFT = 'DRAFT',
  PROPOSED = 'PROPOSED',
  APPROVED = 'APPROVED',
  IN_PROGRESS = 'IN_PROGRESS',
  ACCEPTED = 'ACCEPTED',
  CLOSED = 'CLOSED',
}

// Tình huống/phương án: DRAFT → CALCULATED → REVIEWED → APPROVED → LOCKED → SUPERSEDED.
export enum ScenarioStatus {
  DRAFT = 'DRAFT',
  CALCULATED = 'CALCULATED',
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  LOCKED = 'LOCKED',
  SUPERSEDED = 'SUPERSEDED',
}

// Vòng đời cảnh báo.
export enum AlertStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  ASSIGNED = 'ASSIGNED',
  SNOOZED = 'SNOOZED',
  CLOSED = 'CLOSED',
}
