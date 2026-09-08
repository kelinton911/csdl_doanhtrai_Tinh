import {
  classifyVariance,
  assertQualityTotal,
  bookSnapshotChecksum,
  officialSnapshotChecksum,
} from './count-rules';
import { VarianceType, CAMPAIGN_TRANSITIONS, CampaignStatus, SHEET_TRANSITIONS, SheetStatus } from './dt10.enums';
import { canTransition } from '../../common/enums/assert-transition';
import { BusinessException } from '../../common/errors/business-error';

describe('DT-10 count-rules (thuần)', () => {
  describe('classifyVariance — BR-DT10-013..015', () => {
    it('khớp sổ = thực → null (không variance)', () => {
      expect(classifyVariance(10, 10, true)).toBeNull();
    });
    it('thực < sổ → SHORTAGE', () => {
      expect(classifyVariance(10, 7, true)).toBe(VarianceType.SHORTAGE);
    });
    it('thực > sổ → SURPLUS', () => {
      expect(classifyVariance(10, 12, true)).toBe(VarianceType.SURPLUS);
    });
    it('có sổ nhưng thực = 0 → MISSING', () => {
      expect(classifyVariance(10, 0, true)).toBe(VarianceType.MISSING);
    });
    it('không có dòng sổ, có thực → UNBOOKED (TC-DT10-013)', () => {
      expect(classifyVariance(0, 5, false)).toBe(VarianceType.UNBOOKED);
    });
    it('không sổ, không thực → null', () => {
      expect(classifyVariance(0, 0, false)).toBeNull();
    });
    it('lệch vị trí → LOCATION (ưu tiên nhãn vị trí)', () => {
      expect(classifyVariance(10, 10, true, true)).toBe(VarianceType.LOCATION);
    });
  });

  describe('assertQualityTotal — BR-DT10-009 (TC-DT10-009)', () => {
    it('Σ C1..5 = physical → không ném', () => {
      expect(() => assertQualityTotal([3, 2, 1, 0, 0], 6)).not.toThrow();
    });
    it('Σ C1..5 ≠ physical → QUALITY_TOTAL_MISMATCH', () => {
      try {
        assertQualityTotal([3, 2, 1, 0, 0], 7);
        fail('phải ném');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getCode()).toBe('QUALITY_TOTAL_MISMATCH');
      }
    });
  });

  describe('checksum snapshot — BR-DT10-002/003/019/020', () => {
    const asOf = new Date('2026-09-01T00:00:00Z');
    const linesA = [
      { materialCatalogId: 'm1', lotId: 'l1', qty: 10, grade1: 10 },
      { materialCatalogId: 'm2', lotId: null, qty: 5 },
    ];
    // Cùng nội dung, khác thứ tự dòng → cùng checksum (tất định, không phụ thuộc thứ tự).
    const linesB = [
      { materialCatalogId: 'm2', lotId: null, qty: 5 },
      { materialCatalogId: 'm1', lotId: 'l1', qty: 10, grade1: 10 },
    ];
    it('book_snapshot checksum ổn định theo nội dung (không theo thứ tự)', () => {
      expect(bookSnapshotChecksum(linesA, asOf)).toBe(bookSnapshotChecksum(linesB, asOf));
    });
    it('đổi as_of → đổi checksum (bất biến tại cutoff)', () => {
      expect(bookSnapshotChecksum(linesA, asOf)).not.toBe(
        bookSnapshotChecksum(linesA, new Date('2026-09-02T00:00:00Z')),
      );
    });
    it('official_snapshot: đổi version → đổi checksum (revision)', () => {
      expect(officialSnapshotChecksum(linesA, 1)).not.toBe(officialSnapshotChecksum(linesA, 2));
    });
  });

  describe('state machine transitions', () => {
    it('campaign đi đúng chuỗi DRAFT→CUTOFF→COUNTING→RECONCILING→OFFICIAL_LOCKED', () => {
      expect(canTransition(CAMPAIGN_TRANSITIONS, CampaignStatus.DRAFT, CampaignStatus.CUTOFF)).toBe(true);
      expect(canTransition(CAMPAIGN_TRANSITIONS, CampaignStatus.RECONCILING, CampaignStatus.OFFICIAL_LOCKED)).toBe(true);
      // Không được nhảy thẳng DRAFT → OFFICIAL_LOCKED.
      expect(canTransition(CAMPAIGN_TRANSITIONS, CampaignStatus.DRAFT, CampaignStatus.OFFICIAL_LOCKED)).toBe(false);
    });
    it('RECONCILING mở lại COUNTING để recount (BR-DT10-008)', () => {
      expect(canTransition(CAMPAIGN_TRANSITIONS, CampaignStatus.RECONCILING, CampaignStatus.COUNTING)).toBe(true);
    });
    it('sheet DRAFT→SUBMITTED→APPROVED, không nhảy DRAFT→APPROVED', () => {
      expect(canTransition(SHEET_TRANSITIONS, SheetStatus.DRAFT, SheetStatus.SUBMITTED)).toBe(true);
      expect(canTransition(SHEET_TRANSITIONS, SheetStatus.SUBMITTED, SheetStatus.APPROVED)).toBe(true);
      expect(canTransition(SHEET_TRANSITIONS, SheetStatus.DRAFT, SheetStatus.APPROVED)).toBe(false);
    });
  });
});
