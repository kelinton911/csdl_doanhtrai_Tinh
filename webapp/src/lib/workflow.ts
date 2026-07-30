// Mirror trạng thái workflow của backend (common/workflow.ts) để UI biết khi nào
// cho phép sửa/gửi duyệt. Thực thi thật vẫn ở server.
export const EDITABLE_STATUSES = ['DRAFT', 'CHANGES_REQUESTED'];

export const WORKFLOW_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  CHANGES_REQUESTED: 'Yêu cầu bổ sung',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  LOCKED: 'Đã chốt',
  ARCHIVED: 'Lưu trữ',
};
