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
