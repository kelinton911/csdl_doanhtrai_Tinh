import { HttpException, HttpStatus } from '@nestjs/common';

// Danh mục mã lỗi nghiệp vụ dùng chung (Sprint 0 §2 — 02-QUY-UOC-CHUNG.md).
// SCREAMING_SNAKE_CASE, trả trong `problem.code`. Bổ sung theo phân hệ nhưng
// KHÔNG hard-code chuỗi rời rạc — khai báo tập trung tại đây để tái dùng & test.
export enum BusinessError {
  NO_RULE = 'NO_RULE', // DT-07, DT-08 — không có định mức/quy định (KHÔNG tự coi = 0)
  RULE_CONFLICT = 'RULE_CONFLICT', // DT-07, DT-08 — nhiều norm ngang ưu tiên
  NO_HC_SNAPSHOT = 'NO_HC_SNAPSHOT', // DT-08 — không lấy được HC tại thời điểm
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK', // DT-04, DT-05 — xuất/giảm làm tồn âm
  PERIOD_LOCKED = 'PERIOD_LOCKED', // DT-05, DT-10 — ghi vào kỳ đã khóa
  ASSET_LOCKED = 'ASSET_LOCKED', // DT-05, DT-06 — tài sản đang khóa/reserved
  INVALID_LOCATION = 'INVALID_LOCATION', // DT-04, DT-05 — kho/vị trí ngoài phạm vi
  DUPLICATE_POST = 'DUPLICATE_POST', // DT-05 — POST lặp cùng idempotency-key
  STALE_WRITE = 'STALE_WRITE', // Toàn hệ thống — optimistic lock lệch phiên bản
  SOURCE_CHANGED = 'SOURCE_CHANGED', // DT-09 — nguồn thay đổi giữa xem và giữ
  INSUFFICIENT_FREE_SOURCE = 'INSUFFICIENT_FREE_SOURCE', // DT-09 — giữ nguồn vượt khả dụng
  OVER_ALLOCATED = 'OVER_ALLOCATED', // DT-06, DT-09 — tổng phân bổ/nguồn vượt HC/nhu cầu
  UNIT_MISMATCH = 'UNIT_MISMATCH', // Toàn hệ thống — ĐVT không tương thích
  QUALITY_TOTAL_MISMATCH = 'QUALITY_TOTAL_MISMATCH', // DT-04/10/11 — Σ cấp chất lượng ≠ tổng
  NO_OFFICIAL_SNAPSHOT = 'NO_OFFICIAL_SNAPSHOT', // DT-11 — chưa có snapshot chính thức
  DATA_CONTRACT_MISMATCH = 'DATA_CONTRACT_MISMATCH', // DT-11 — nguồn không khớp schema dataset
  MISSING_SUBMISSION = 'MISSING_SUBMISSION', // DT-11, DT-12 — đơn vị con chưa gửi (không = 0)
  LOCKED_IMMUTABLE = 'LOCKED_IMMUTABLE', // DT-04/08/10/11 — sửa bản ghi đã khóa
  NO_PERMISSION_SCOPE = 'NO_PERMISSION_SCOPE', // Toàn hệ thống — vượt phạm vi dữ liệu
}

// HTTP status mặc định cho mỗi mã lỗi (theo bảng §2). `MISSING_SUBMISSION`
// là tình huống nghiệp vụ (đơn vị con chưa gửi) — biểu diễn 200 trong dataset,
// nhưng khi ném như lỗi thì trả 422 để phân biệt với "= 0".
export const BUSINESS_ERROR_STATUS: Record<BusinessError, HttpStatus> = {
  [BusinessError.NO_RULE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.RULE_CONFLICT]: HttpStatus.CONFLICT,
  [BusinessError.NO_HC_SNAPSHOT]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.INSUFFICIENT_STOCK]: HttpStatus.CONFLICT,
  [BusinessError.PERIOD_LOCKED]: HttpStatus.CONFLICT,
  [BusinessError.ASSET_LOCKED]: HttpStatus.CONFLICT,
  [BusinessError.INVALID_LOCATION]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.DUPLICATE_POST]: HttpStatus.CONFLICT,
  [BusinessError.STALE_WRITE]: HttpStatus.CONFLICT,
  [BusinessError.SOURCE_CHANGED]: HttpStatus.CONFLICT,
  [BusinessError.INSUFFICIENT_FREE_SOURCE]: HttpStatus.CONFLICT,
  [BusinessError.OVER_ALLOCATED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.UNIT_MISMATCH]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.QUALITY_TOTAL_MISMATCH]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.NO_OFFICIAL_SNAPSHOT]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.DATA_CONTRACT_MISMATCH]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.MISSING_SUBMISSION]: HttpStatus.UNPROCESSABLE_ENTITY,
  [BusinessError.LOCKED_IMMUTABLE]: HttpStatus.CONFLICT,
  [BusinessError.NO_PERMISSION_SCOPE]: HttpStatus.FORBIDDEN,
};

// Thông điệp mặc định (tiếng Việt) cho mỗi mã — dùng làm `title` khi không truyền detail.
export const BUSINESS_ERROR_TITLE: Record<BusinessError, string> = {
  [BusinessError.NO_RULE]: 'Không có định mức/quy định áp dụng',
  [BusinessError.RULE_CONFLICT]: 'Xung đột định mức chưa được giải quyết',
  [BusinessError.NO_HC_SNAPSHOT]: 'Không lấy được số hiện có tại thời điểm',
  [BusinessError.INSUFFICIENT_STOCK]: 'Không đủ tồn kho',
  [BusinessError.PERIOD_LOCKED]: 'Kỳ đã bị khóa',
  [BusinessError.ASSET_LOCKED]: 'Tài sản đang bị khóa hoặc đã giữ chỗ',
  [BusinessError.INVALID_LOCATION]: 'Kho/vị trí không thuộc phạm vi',
  [BusinessError.DUPLICATE_POST]: 'Yêu cầu trùng lặp (idempotency-key)',
  [BusinessError.STALE_WRITE]: 'Dữ liệu đã bị thay đổi bởi phiên khác',
  [BusinessError.SOURCE_CHANGED]: 'Nguồn đã thay đổi giữa lúc xem và lúc giữ',
  [BusinessError.INSUFFICIENT_FREE_SOURCE]: 'Giữ nguồn vượt quá khả dụng',
  [BusinessError.OVER_ALLOCATED]: 'Tổng phân bổ/nguồn vượt hiện có/nhu cầu',
  [BusinessError.UNIT_MISMATCH]: 'Đơn vị tính không tương thích',
  [BusinessError.QUALITY_TOTAL_MISMATCH]: 'Tổng theo cấp chất lượng không khớp tổng số',
  [BusinessError.NO_OFFICIAL_SNAPSHOT]: 'Chưa có snapshot chính thức của kỳ',
  [BusinessError.DATA_CONTRACT_MISMATCH]: 'Nguồn không khớp schema dataset',
  [BusinessError.MISSING_SUBMISSION]: 'Đơn vị con chưa gửi số liệu (không tính = 0)',
  [BusinessError.LOCKED_IMMUTABLE]: 'Bản ghi đã khóa, không được sửa',
  [BusinessError.NO_PERMISSION_SCOPE]: 'Vượt phạm vi dữ liệu được giao',
};

// Ngoại lệ nghiệp vụ chuẩn: mang theo `code` ổn định + HTTP status + detail.
// Kế thừa HttpException để pipeline Nest xử lý status đúng; ProblemExceptionFilter
// đọc `getCode()` render vào problem.code (RFC7807).
export class BusinessException extends HttpException {
  readonly code: BusinessError;

  constructor(code: BusinessError, detail?: string, httpStatus?: HttpStatus) {
    const status = httpStatus ?? BUSINESS_ERROR_STATUS[code];
    super(
      { code, message: detail ?? BUSINESS_ERROR_TITLE[code], status },
      status,
    );
    this.code = code;
  }

  getCode(): BusinessError {
    return this.code;
  }
}
