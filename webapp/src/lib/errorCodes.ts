import type { ProblemError } from './api';

// Bản đồ mã lỗi nghiệp vụ → thông điệp tiếng Việt (đồng bộ với backend
// common/errors/business-error.ts — Sprint 0 §2). Backend đã trả `title` tiếng Việt,
// bản đồ này là nguồn hiển thị/i18n phía client (ổn định khi đổi ngôn ngữ hoặc khi
// backend chỉ trả `code`). Giữ ĐỒNG BỘ khi bổ sung mã mới.
export const BUSINESS_ERROR_MESSAGES: Record<string, string> = {
  NO_RULE: 'Không có định mức/quy định áp dụng (không tự coi = 0)',
  RULE_CONFLICT: 'Xung đột định mức chưa được giải quyết',
  NO_HC_SNAPSHOT: 'Không lấy được số hiện có tại thời điểm',
  INSUFFICIENT_STOCK: 'Không đủ tồn kho',
  PERIOD_LOCKED: 'Kỳ đã bị khóa',
  ASSET_LOCKED: 'Tài sản đang bị khóa hoặc đã giữ chỗ',
  INVALID_LOCATION: 'Kho/vị trí không thuộc phạm vi',
  DUPLICATE_POST: 'Yêu cầu trùng lặp (idempotency-key)',
  STALE_WRITE: 'Dữ liệu đã bị thay đổi bởi phiên khác — hãy tải lại và thử lại',
  SOURCE_CHANGED: 'Nguồn đã thay đổi giữa lúc xem và lúc giữ',
  INSUFFICIENT_FREE_SOURCE: 'Giữ nguồn vượt quá khả dụng',
  OVER_ALLOCATED: 'Tổng phân bổ/nguồn vượt hiện có/nhu cầu',
  UNIT_MISMATCH: 'Đơn vị tính không tương thích',
  QUALITY_TOTAL_MISMATCH: 'Tổng theo cấp chất lượng không khớp tổng số',
  NO_OFFICIAL_SNAPSHOT: 'Chưa có snapshot chính thức của kỳ',
  DATA_CONTRACT_MISMATCH: 'Nguồn không khớp schema dataset',
  MISSING_SUBMISSION: 'Đơn vị con chưa gửi số liệu (không tính = 0)',
  LOCKED_IMMUTABLE: 'Bản ghi đã khóa, không được sửa',
  NO_PERMISSION_SCOPE: 'Bạn không có quyền trên phạm vi dữ liệu này',
};

// Thông điệp hiển thị cho người dùng: ưu tiên bản đồ i18n theo mã, sau đó
// tới `title` từ backend, cuối cùng là thông báo chung.
export function problemMessage(problem: ProblemError): string {
  return (
    BUSINESS_ERROR_MESSAGES[problem.code] ??
    problem.title ??
    'Đã xảy ra lỗi, vui lòng thử lại'
  );
}
