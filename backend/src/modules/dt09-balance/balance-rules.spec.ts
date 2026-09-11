import {
  CandidateRow,
  assertMobilizable,
  assertReservationWithinAvailable,
  computeBalanceChecksum,
  computeGap,
  effectiveVerificationStatus,
  isEligible,
  rankCandidates,
  sourceFingerprint,
} from './balance-rules';
import { VerificationStatus } from './dt09.enums';
import { BusinessError, BusinessException } from '../../common/errors/business-error';

const NOW = new Date('2026-09-08T00:00:00Z');
const PAST = new Date('2026-01-01T00:00:00Z');
const FUTURE = new Date('2027-01-01T00:00:00Z');

// Nguồn candidate mặc định "đạt" mọi bước; ghi đè từng trường để test lý do loại.
function row(over: Partial<CandidateRow> = {}): CandidateRow {
  return {
    sourceMaterialId: over.sourceMaterialId ?? 'sm-1',
    sourceId: over.sourceId ?? 'src-1',
    materialCatalogId: over.materialCatalogId ?? 'MAT',
    verificationStatus: over.verificationStatus ?? VerificationStatus.VERIFIED,
    verifiedQty: over.verifiedQty ?? 100,
    expiresAt: over.expiresAt ?? FUTURE,
    mobilizableQty: over.mobilizableQty ?? 50,
    leadTimeDays: over.leadTimeDays ?? 3,
    activeReserved: over.activeReserved ?? 0,
    distanceKm: over.distanceKm ?? 5,
    priority: over.priority ?? 100,
  };
}

describe('DT-09 balance-rules — quy tắc nghiệp vụ thuần', () => {
  describe('TC-DT09-001/012 — vòng đời xác minh & hết hạn', () => {
    it('VERIFIED còn hạn ⇒ VERIFIED', () => {
      expect(effectiveVerificationStatus(VerificationStatus.VERIFIED, FUTURE, NOW)).toBe(VerificationStatus.VERIFIED);
    });
    it('TC-012: VERIFIED nhưng quá hạn ⇒ EXPIRED', () => {
      expect(effectiveVerificationStatus(VerificationStatus.VERIFIED, PAST, NOW)).toBe(VerificationStatus.EXPIRED);
    });
    it('UNVERIFIED giữ nguyên UNVERIFIED', () => {
      expect(effectiveVerificationStatus(VerificationStatus.UNVERIFIED, null, NOW)).toBe(VerificationStatus.UNVERIFIED);
    });
    it('TC-001: UNVERIFIED không ELIGIBLE (VERIFIED ≠ ELIGIBLE, còn phải VERIFIED trước)', () => {
      expect(
        isEligible({ status: VerificationStatus.UNVERIFIED, expiresAt: null, mobilizableQty: 10, leadTimeDays: 1, deadlineDays: 10, now: NOW }),
      ).toBe(false);
    });
    it('VERIFIED + có huy động + lead_time ≤ deadline ⇒ ELIGIBLE', () => {
      expect(
        isEligible({ status: VerificationStatus.VERIFIED, expiresAt: FUTURE, mobilizableQty: 10, leadTimeDays: 3, deadlineDays: 5, now: NOW }),
      ).toBe(true);
    });
    it('VERIFIED nhưng chưa có mobilizable ⇒ chưa ELIGIBLE', () => {
      expect(
        isEligible({ status: VerificationStatus.VERIFIED, expiresAt: FUTURE, mobilizableQty: 0, leadTimeDays: 1, deadlineDays: 5, now: NOW }),
      ).toBe(false);
    });
    it('VERIFIED nhưng lead_time > deadline ⇒ chưa ELIGIBLE', () => {
      expect(
        isEligible({ status: VerificationStatus.VERIFIED, expiresAt: FUTURE, mobilizableQty: 10, leadTimeDays: 9, deadlineDays: 5, now: NOW }),
      ).toBe(false);
    });
  });

  describe('TC-DT09-003 — mobilizable ≤ verified', () => {
    it('mobilizable ≤ verified ⇒ OK', () => {
      expect(() => assertMobilizable(40, 100)).not.toThrow();
    });
    it('TC-003: mobilizable > verified ⇒ OVER_ALLOCATED', () => {
      expect(() => assertMobilizable(120, 100)).toThrow(BusinessException);
      try {
        assertMobilizable(120, 100);
      } catch (e) {
        expect((e as BusinessException).getCode()).toBe(BusinessError.OVER_ALLOCATED);
      }
    });
    it('chưa xác minh (verified null) ⇒ từ chối', () => {
      expect(() => assertMobilizable(10, null)).toThrow(BusinessException);
    });
  });

  describe('TC-DT09-008 — chống overbooking', () => {
    it('Σ active + mới ≤ available ⇒ OK', () => {
      expect(() => assertReservationWithinAvailable(30, 20, 50)).not.toThrow();
    });
    it('TC-008: Σ active + mới > available ⇒ INSUFFICIENT_FREE_SOURCE', () => {
      try {
        assertReservationWithinAvailable(40, 20, 50);
        fail('phải ném');
      } catch (e) {
        expect((e as BusinessException).getCode()).toBe(BusinessError.INSUFFICIENT_FREE_SOURCE);
      }
    });
  });

  describe('Gap = supply_required − Σ planned', () => {
    it('phủ đủ ⇒ COVERED', () => {
      expect(computeGap(100, 100)).toEqual({ gap: 0, status: 'COVERED' });
    });
    it('một phần ⇒ PARTIAL', () => {
      expect(computeGap(100, 40)).toEqual({ gap: 60, status: 'PARTIAL' });
    });
    it('chưa có ⇒ OPEN', () => {
      expect(computeGap(100, 0)).toEqual({ gap: 100, status: 'OPEN' });
    });
    it('vượt ⇒ gap ≤ 0, COVERED', () => {
      expect(computeGap(100, 120)).toEqual({ gap: -20, status: 'COVERED' });
    });
  });

  describe('Candidate 8 bước — lọc + xếp hạng + lý do loại', () => {
    const opts = { materialCatalogId: 'MAT', now: NOW, deadlineDays: 7, radiusKm: 20 };

    it('nguồn đạt đủ ⇒ vào ranked với availableQty = mobilizable − active', () => {
      const res = rankCandidates([row({ mobilizableQty: 50, activeReserved: 10 })], opts);
      expect(res.rejected).toHaveLength(0);
      expect(res.ranked).toHaveLength(1);
      expect(res.ranked[0].availableQty).toBe(40);
    });
    it('khác vật chất ⇒ MATERIAL_MISMATCH', () => {
      const res = rankCandidates([row({ materialCatalogId: 'OTHER' })], opts);
      expect(res.rejected[0].reason).toBe('MATERIAL_MISMATCH');
    });
    it('chưa xác minh ⇒ NOT_VERIFIED', () => {
      const res = rankCandidates([row({ verificationStatus: VerificationStatus.UNVERIFIED })], opts);
      expect(res.rejected[0].reason).toBe('NOT_VERIFIED');
    });
    it('TC-012: hết hạn ⇒ EXPIRED', () => {
      const res = rankCandidates([row({ expiresAt: PAST })], opts);
      expect(res.rejected[0].reason).toBe('EXPIRED');
    });
    it('không huy động được ⇒ NOT_MOBILIZABLE', () => {
      const res = rankCandidates([row({ mobilizableQty: 0 })], opts);
      expect(res.rejected[0].reason).toBe('NOT_MOBILIZABLE');
    });
    it('đã giữ hết ⇒ NO_AVAILABLE', () => {
      const res = rankCandidates([row({ mobilizableQty: 10, activeReserved: 10 })], opts);
      expect(res.rejected[0].reason).toBe('NO_AVAILABLE');
    });
    it('ngoài bán kính ⇒ OUT_OF_RADIUS', () => {
      const res = rankCandidates([row({ distanceKm: 50 })], opts);
      expect(res.rejected[0].reason).toBe('OUT_OF_RADIUS');
    });
    it('lead_time vượt deadline ⇒ LEAD_TIME_EXCEEDED', () => {
      const res = rankCandidates([row({ leadTimeDays: 30 })], opts);
      expect(res.rejected[0].reason).toBe('LEAD_TIME_EXCEEDED');
    });
    it('xếp hạng: priority nhỏ hơn đứng trước', () => {
      const res = rankCandidates(
        [
          row({ sourceMaterialId: 'lo', priority: 200 }),
          row({ sourceMaterialId: 'hi', priority: 50 }),
        ],
        opts,
      );
      expect(res.ranked.map((r) => r.sourceMaterialId)).toEqual(['hi', 'lo']);
    });
    it('cùng priority: lead_time nhỏ hơn đứng trước', () => {
      const res = rankCandidates(
        [
          row({ sourceMaterialId: 'slow', leadTimeDays: 5 }),
          row({ sourceMaterialId: 'fast', leadTimeDays: 1 }),
        ],
        opts,
      );
      expect(res.ranked.map((r) => r.sourceMaterialId)).toEqual(['fast', 'slow']);
    });
    it('không truyền bán kính ⇒ bỏ qua lọc khoảng cách', () => {
      const res = rankCandidates([row({ distanceKm: 999 })], { ...opts, radiusKm: null });
      expect(res.ranked).toHaveLength(1);
    });
    it('gắn rank 1-based khớp đúng thứ tự xếp hạng', () => {
      const res = rankCandidates(
        [
          row({ sourceMaterialId: 'lo', priority: 200 }),
          row({ sourceMaterialId: 'hi', priority: 50 }),
        ],
        opts,
      );
      expect(res.ranked.map((r) => [r.sourceMaterialId, r.rank])).toEqual([
        ['hi', 1],
        ['lo', 2],
      ]);
    });
  });

  describe('TC-DT09-020 — fingerprint & checksum bất biến/tất định', () => {
    const entries = [
      { sourceMaterialId: 'b', verificationStatus: VerificationStatus.VERIFIED, verifiedQty: 10, mobilizableQty: 8, reservedQty: 5 },
      { sourceMaterialId: 'a', verificationStatus: VerificationStatus.VERIFIED, verifiedQty: 20, mobilizableQty: 15, reservedQty: 7 },
    ];
    it('fingerprint không phụ thuộc thứ tự đầu vào', () => {
      expect(sourceFingerprint(entries)).toBe(sourceFingerprint([...entries].reverse()));
    });
    it('đổi verifiedQty ⇒ fingerprint đổi', () => {
      const changed = entries.map((e) => (e.sourceMaterialId === 'a' ? { ...e, verifiedQty: 99 } : e));
      expect(sourceFingerprint(changed)).not.toBe(sourceFingerprint(entries));
    });
    it('checksum tất định theo nội dung', () => {
      const lines = [{ materialCatalogId: 'MAT', supplyRequired: 100, plannedSourceQty: 60, gapQty: 40 }];
      const fp = sourceFingerprint(entries);
      expect(computeBalanceChecksum('BP-1', 1, lines, fp)).toBe(computeBalanceChecksum('BP-1', 1, lines, fp));
    });
    it('đổi gap ⇒ checksum đổi', () => {
      const fp = sourceFingerprint(entries);
      const a = computeBalanceChecksum('BP-1', 1, [{ materialCatalogId: 'MAT', supplyRequired: 100, plannedSourceQty: 60, gapQty: 40 }], fp);
      const b = computeBalanceChecksum('BP-1', 1, [{ materialCatalogId: 'MAT', supplyRequired: 100, plannedSourceQty: 70, gapQty: 30 }], fp);
      expect(a).not.toBe(b);
    });
  });
});
