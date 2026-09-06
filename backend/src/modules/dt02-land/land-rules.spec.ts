import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  areaAtSnapshot,
  assertAllocationWithinArea,
  assertAreaPositive,
  assertStorageParent,
  wouldCreateStorageCycle,
} from './land-rules';

describe('DT-02 land-rules (Quyển II §VII)', () => {
  describe('TC-DT02-003 diện tích > 0', () => {
    it('≤ 0 → từ chối', () => {
      expect(() => assertAreaPositive(0)).toThrow(BadRequestException);
      expect(() => assertAreaPositive(-5)).toThrow(BadRequestException);
    });
    it('> 0 → hợp lệ', () => {
      expect(() => assertAreaPositive(120.5)).not.toThrow();
    });
  });

  describe('BR-DT02-004 Σ phân bổ ≤ diện tích (TC-DT02-004)', () => {
    it('tổng vượt diện tích → từ chối', () => {
      expect(() => assertAllocationWithinArea([600, 300], 200, 1000)).toThrow(ConflictException);
    });
    it('tổng bằng/nhỏ hơn → hợp lệ', () => {
      expect(() => assertAllocationWithinArea([600, 300], 100, 1000)).not.toThrow();
      expect(() => assertAllocationWithinArea([], 1000, 1000)).not.toThrow();
    });
  });

  describe('BR-DT02-005/007 diện tích tại snapshot (TC-DT02-007)', () => {
    const changes = [{ areaDeltaM2: 500, effectiveDate: '2026-06-01' }];
    it('kỳ trước biến động không đổi', () => {
      expect(areaAtSnapshot(1000, changes, '2026-03-31')).toBe(1000);
    });
    it('kỳ sau biến động tăng +500', () => {
      expect(areaAtSnapshot(1000, changes, '2026-09-30')).toBe(1500);
    });
    it('cộng dồn nhiều biến động, có cả giảm', () => {
      const cs = [
        { areaDeltaM2: 500, effectiveDate: '2026-06-01' },
        { areaDeltaM2: -200, effectiveDate: '2026-07-01' },
      ];
      expect(areaAtSnapshot(1000, cs, '2026-12-31')).toBe(1300);
    });
  });

  describe('BR-DT02-019/020 cây kho (TC-DT02-017)', () => {
    const nodes = [
      { id: 'K', parentId: null },
      { id: 'A', parentId: 'K' },
      { id: 'B', parentId: 'A' },
    ];
    it('tự làm cha → vòng lặp', () => {
      expect(wouldCreateStorageCycle(nodes, 'A', 'A')).toBe(true);
      expect(() => assertStorageParent(nodes, 'A', 'A')).toThrow(ConflictException);
    });
    it('K→A→B→K → vòng lặp', () => {
      expect(wouldCreateStorageCycle(nodes, 'K', 'B')).toBe(true);
    });
    it('gán cha hợp lệ', () => {
      expect(() => assertStorageParent(nodes, 'B', 'K')).not.toThrow();
    });
  });
});
