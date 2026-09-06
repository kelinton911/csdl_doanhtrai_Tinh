import { ConflictException } from '@nestjs/common';

// Kiểm tra một bước chuyển trạng thái có hợp lệ theo bảng transition không.
// Ném 409 (mã WF-002) nếu bước chuyển không được phép — chống nhảy trạng thái tùy tiện.
export function assertTransition<S extends string>(
  transitions: Record<S, S[]>,
  from: S,
  to: S,
): void {
  const allowed = transitions[from] ?? [];
  if (from === to) return; // idempotent: giữ nguyên trạng thái không phải lỗi.
  if (!allowed.includes(to)) {
    throw new ConflictException(
      `WF-002: Không thể chuyển trạng thái ${from} → ${to}`,
    );
  }
}

// Trả về true/false thay vì ném — tiện cho kiểm thử/branching.
export function canTransition<S extends string>(
  transitions: Record<S, S[]>,
  from: S,
  to: S,
): boolean {
  if (from === to) return true;
  return (transitions[from] ?? []).includes(to);
}
