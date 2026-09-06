import { BadRequestException } from '@nestjs/common';

// Múi giờ thống nhất toàn hệ thống (Sprint 0 §1). Việt Nam UTC+7, không có DST.
export const HCMC_TZ = 'Asia/Ho_Chi_Minh';
export const HCMC_OFFSET = '+07:00';
const OFFSET_MS = 7 * 60 * 60 * 1000;

// "Bây giờ" (thời điểm hiện tại, kiểu Date UTC nội bộ).
export function nowHcm(): Date {
  return new Date();
}

// Chuẩn hóa tham số truy vấn "tại thời điểm" (as_of_time, ISO-8601).
// - Không truyền → thời điểm hiện tại.
// - ISO hợp lệ → Date tương ứng.
// - Không hợp lệ → 400 (VAL) để tránh tính nhầm mốc thời gian.
export function resolveAsOf(input?: string | Date | null): Date {
  if (input === undefined || input === null || input === '') return nowHcm();
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      throw new BadRequestException('VAL-001: as_of_time không hợp lệ');
    }
    return input;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`VAL-001: as_of_time không hợp lệ: ${input}`);
  }
  return parsed;
}

// Định dạng ISO-8601 theo giờ Asia/Ho_Chi_Minh (hậu tố +07:00), phục vụ hiển thị
// & trả về trong response wrapper để client thấy đúng mốc "tại thời điểm".
export function toHcmIso(date: Date): string {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  const iso = shifted.toISOString(); // ...Z
  return iso.replace(/\.\d{3}Z$/, '').replace(/Z$/, '') + HCMC_OFFSET;
}
