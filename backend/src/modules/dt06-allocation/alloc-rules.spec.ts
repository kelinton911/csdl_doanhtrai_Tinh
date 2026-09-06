import { BusinessException } from '../../common/errors/business-error';
import { assertTransition } from '../../common/enums/assert-transition';
import {
  ALLOCATION_TRANSITIONS,
  AllocationStatus,
  assertAllocationSnapshotUnlocked,
  assertExclusiveWithinAllocatable,
  assertHcCoversHolds,
  hcAllocatable,
  reserveGap,
  sumExclusive,
} from './alloc-rules';

describe('DT-06 alloc-rules (Quyển VI §III/§VIII)', () => {
  describe('SYS-BR-05 Σ exclusive ≤ HC_ALLOCATABLE (TC-DT06-002/003)', () => {
    it('HC_ALLOCATABLE = HC − loại trừ', () => {
      expect(hcAllocatable(100, 20)).toBe(80);
      expect(hcAllocatable(100)).toBe(100);
    });
    it('khóa exclusive tổng > khả dụng → OVER_ALLOCATED', () => {
      expect.assertions(2);
      try {
        assertExclusiveWithinAllocatable([60, 30], 20, 100); // 110 > 100
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getCode()).toBe('OVER_ALLOCATED');
      }
    });
    it('hai nhiệm vụ cùng khóa — chỉ nhận trong giới hạn (không cộng trùng)', () => {
      // Đã khóa 70; nhiệm vụ 2 xin thêm 30 → vừa đủ 100.
      expect(() => assertExclusiveWithinAllocatable([70], 30, 100)).not.toThrow();
      // Nhưng xin 40 → vượt.
      expect(() => assertExclusiveWithinAllocatable([70], 40, 100)).toThrow(BusinessException);
    });
    it('OVERLAY không tính vào ràng buộc (chỉ truyền exclusive vào hàm)', () => {
      expect(sumExclusive([50])).toBe(50); // caller chỉ đưa exclusive holds
    });
  });

  describe('BR-DT06-008 đối chiếu định mức (TC-DT06-008)', () => {
    it('thiếu / đủ / vượt', () => {
      expect(reserveGap(100, 60)).toEqual({ gapQty: 40, status: 'SHORTAGE' });
      expect(reserveGap(100, 100)).toEqual({ gapQty: 0, status: 'MET' });
      expect(reserveGap(100, 130)).toEqual({ gapQty: -30, status: 'EXCESS' });
    });
  });

  describe('BR-DT06-020 DT-05 giảm HC dưới hold (TC-DT06-020)', () => {
    it('HC sau < tổng hold → chặn', () => {
      expect.assertions(1);
      try {
        assertHcCoversHolds(40, 60);
      } catch (e) {
        expect((e as BusinessException).getCode()).toBe('OVER_ALLOCATED');
      }
    });
    it('HC sau ≥ tổng hold → hợp lệ', () => {
      expect(() => assertHcCoversHolds(80, 60)).not.toThrow();
    });
  });

  describe('workflow + snapshot khóa (TC-DT06-006/023)', () => {
    it('chuyển loại qua duyệt DRAFT→SUBMITTED→APPROVED', () => {
      expect(() => {
        assertTransition(ALLOCATION_TRANSITIONS, AllocationStatus.DRAFT, AllocationStatus.SUBMITTED);
        assertTransition(ALLOCATION_TRANSITIONS, AllocationStatus.SUBMITTED, AllocationStatus.APPROVED);
      }).not.toThrow();
    });
    it('snapshot phân bổ LOCKED bất biến', () => {
      expect.assertions(1);
      try {
        assertAllocationSnapshotUnlocked(true);
      } catch (e) {
        expect((e as BusinessException).getCode()).toBe('LOCKED_IMMUTABLE');
      }
    });
  });
});
