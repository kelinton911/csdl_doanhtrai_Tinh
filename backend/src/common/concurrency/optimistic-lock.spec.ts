import {
  assertRowVersion,
  isOptimisticLockError,
  parseExpectedVersion,
} from './optimistic-lock';
import { BusinessException } from '../errors/business-error';

describe('optimistic lock (Sprint 0 §1 GAP-3, TC-S0-002)', () => {
  describe('parseExpectedVersion', () => {
    it('đọc từ header If-Match dạng số', () => {
      expect(parseExpectedVersion('5')).toBe(5);
    });
    it('đọc ETag có ngoặc kép và weak validator', () => {
      expect(parseExpectedVersion('"7"')).toBe(7);
      expect(parseExpectedVersion('W/"9"')).toBe(9);
    });
    it('fallback sang row_version của body khi không có header', () => {
      expect(parseExpectedVersion(undefined, 3)).toBe(3);
    });
    it('không có gì → undefined (bỏ qua kiểm tra)', () => {
      expect(parseExpectedVersion(undefined, null)).toBeUndefined();
      expect(parseExpectedVersion('')).toBeUndefined();
    });
  });

  describe('assertRowVersion', () => {
    it('khớp phiên bản → không ném', () => {
      expect(() => assertRowVersion(4, 4)).not.toThrow();
    });
    it('không gửi If-Match → bỏ qua', () => {
      expect(() => assertRowVersion(4, undefined)).not.toThrow();
    });
    it('lệch phiên bản → 409 STALE_WRITE', () => {
      expect.assertions(2);
      try {
        assertRowVersion(4, 2);
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getCode()).toBe('STALE_WRITE');
      }
    });
  });

  describe('isOptimisticLockError', () => {
    it('nhận diện theo tên class TypeORM', () => {
      const err = new Error('...');
      err.name = 'OptimisticLockVersionMismatchError';
      expect(isOptimisticLockError(err)).toBe(true);
    });
    it('không nhầm lỗi thường', () => {
      expect(isOptimisticLockError(new Error('boom'))).toBe(false);
    });
  });
});
