import { BusinessError, BusinessException } from '../errors/business-error';

// Optimistic concurrency (Sprint 0 §1 GAP-3, mã STALE_WRITE).
// Hai lối dùng:
//   1. Service tự so phiên bản: gọi assertRowVersion(entity.rowVersion, ifMatch)
//      trước khi lưu — lệch → 409 STALE_WRITE.
//   2. Dùng optimistic lock có sẵn của TypeORM (findOne + save): interceptor
//      mapOptimisticError() dịch OptimisticLockVersionMismatchError → STALE_WRITE.

// Đọc số phiên bản kỳ vọng từ header If-Match hoặc row_version của body.
export function parseExpectedVersion(
  ifMatch: string | string[] | undefined,
  bodyRowVersion?: number | string | null,
): number | undefined {
  const fromHeader = Array.isArray(ifMatch) ? ifMatch[0] : ifMatch;
  const raw = fromHeader ?? bodyRowVersion;
  if (raw === undefined || raw === null || raw === '') return undefined;
  // Cho phép ETag dạng "5" (có dấu ngoặc kép) hoặc weak validator W/"5" hoặc số thuần.
  // Bỏ tiền tố W/ trước, rồi mới bỏ ngoặc kép bao ngoài.
  const cleaned = String(raw).replace(/^W\//, '').replace(/^"|"$/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

// Ném STALE_WRITE nếu phiên bản kỳ vọng khác phiên bản hiện tại của bản ghi.
// Không truyền expected (client không gửi If-Match) → bỏ qua kiểm tra (tùy chọn).
export function assertRowVersion(
  currentVersion: number,
  expected: number | undefined,
): void {
  if (expected === undefined) return;
  if (expected !== currentVersion) {
    throw new BusinessException(
      BusinessError.STALE_WRITE,
      `Phiên bản kỳ vọng ${expected} ≠ phiên bản hiện tại ${currentVersion}`,
    );
  }
}

// Nhận diện lỗi optimistic lock của TypeORM theo tên class (tránh phụ thuộc import
// runtime khi test không có TypeORM khởi tạo).
export function isOptimisticLockError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'OptimisticLockVersionMismatchError' ||
      /optimistic lock/i.test(err.message))
  );
}
