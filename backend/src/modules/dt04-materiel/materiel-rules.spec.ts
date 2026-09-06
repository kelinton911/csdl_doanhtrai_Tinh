import { BusinessException } from '../../common/errors/business-error';
import { assertTransition } from '../../common/enums/assert-transition';
import {
  MOVEMENT_TRANSITIONS,
  MovementStatus,
  MovementType,
  assertMovementEditable,
  assertQualityWithinHc,
  assertSnapshotUnlocked,
  assertSufficientStock,
  hcAtTime,
  movementSign,
  signedQuantity,
} from './materiel-rules';

describe('DT-04 materiel-rules (Quyển IV §II/§VII)', () => {
  describe('signedQuantity / movementSign', () => {
    it('nhập (+), xuất (−), điều chuyển', () => {
      expect(movementSign(MovementType.RECEIPT)).toBe(1);
      expect(movementSign(MovementType.ISSUE)).toBe(-1);
      expect(signedQuantity(MovementType.RECEIPT, 10)).toBe(10);
      expect(signedQuantity(MovementType.ISSUE, 10)).toBe(-10);
      expect(signedQuantity(MovementType.TRANSFER_OUT, 5)).toBe(-5);
    });
    it('ADJUSTMENT dùng delta có dấu', () => {
      expect(signedQuantity(MovementType.ADJUSTMENT, -3)).toBe(-3);
      expect(signedQuantity(MovementType.ADJUSTMENT, 4)).toBe(4);
    });
  });

  describe('HC(t) as-of-time (TC-DT04-007)', () => {
    const entries = [
      { status: MovementStatus.POSTED, effectiveTime: '2026-01-10', signed: 100 }, // nhập
      { status: MovementStatus.POSTED, effectiveTime: '2026-03-05', signed: -30 }, // xuất
      { status: MovementStatus.POSTED, effectiveTime: '2026-06-01', signed: 50 }, // nhập
      { status: MovementStatus.APPROVED, effectiveTime: '2026-02-01', signed: 999 }, // chưa POSTED → bỏ
      { status: MovementStatus.DRAFT, effectiveTime: '2026-01-01', signed: 888 }, // bỏ
    ];
    it('chỉ tính giao dịch POSTED có effective_time ≤ as_of', () => {
      expect(hcAtTime(entries, '2026-02-01')).toBe(100); // chỉ giao dịch 10/1
      expect(hcAtTime(entries, '2026-04-01')).toBe(70); // 100 − 30
      expect(hcAtTime(entries, '2026-12-31')).toBe(120); // 100 − 30 + 50
    });
    it('bỏ qua giao dịch chưa POSTED dù effective_time ≤ as_of', () => {
      expect(hcAtTime(entries, '2026-12-31')).not.toBe(120 + 999);
    });
  });

  describe('BR-DT04-005 không tồn âm (TC-DT04-003)', () => {
    it('xuất vượt tồn → INSUFFICIENT_STOCK', () => {
      expect.assertions(2);
      try {
        assertSufficientStock(20, -50);
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getCode()).toBe('INSUFFICIENT_STOCK');
      }
    });
    it('đủ tồn → không ném; cấu hình cho phép âm → bỏ qua', () => {
      expect(() => assertSufficientStock(50, -50)).not.toThrow();
      expect(() => assertSufficientStock(20, -50, true)).not.toThrow();
    });
  });

  describe('BR-DT04-006 Σ chất lượng ≤ HC (TC-DT04-008)', () => {
    it('Σ cấp > HC → QUALITY_TOTAL_MISMATCH', () => {
      expect.assertions(1);
      try {
        assertQualityWithinHc([40, 40, 30], 100);
      } catch (e) {
        expect((e as BusinessException).getCode()).toBe('QUALITY_TOTAL_MISMATCH');
      }
    });
    it('Σ ≤ HC → hợp lệ', () => {
      expect(() => assertQualityWithinHc([40, 30, 20], 100)).not.toThrow();
    });
  });

  describe('máy trạng thái + bất biến (TC-DT04-004)', () => {
    it('DRAFT→POSTED trực tiếp không hợp lệ', () => {
      expect(() => assertTransition(MOVEMENT_TRANSITIONS, MovementStatus.DRAFT, MovementStatus.POSTED)).toThrow();
    });
    it('chuỗi hợp lệ DRAFT→SUBMITTED→APPROVED→POSTED→REVERSED', () => {
      expect(() => {
        assertTransition(MOVEMENT_TRANSITIONS, MovementStatus.DRAFT, MovementStatus.SUBMITTED);
        assertTransition(MOVEMENT_TRANSITIONS, MovementStatus.SUBMITTED, MovementStatus.APPROVED);
        assertTransition(MOVEMENT_TRANSITIONS, MovementStatus.APPROVED, MovementStatus.POSTED);
        assertTransition(MOVEMENT_TRANSITIONS, MovementStatus.POSTED, MovementStatus.REVERSED);
      }).not.toThrow();
    });
    it('POSTED không sửa trực tiếp → LOCKED_IMMUTABLE', () => {
      expect(() => assertMovementEditable(MovementStatus.POSTED)).toThrow(BusinessException);
      expect(() => assertMovementEditable(MovementStatus.DRAFT)).not.toThrow();
    });
  });

  describe('BR-DT04-011 snapshot khóa (TC-DT04-017)', () => {
    it('snapshot LOCKED → LOCKED_IMMUTABLE', () => {
      expect.assertions(1);
      try {
        assertSnapshotUnlocked(true);
      } catch (e) {
        expect((e as BusinessException).getCode()).toBe('LOCKED_IMMUTABLE');
      }
    });
  });
});
