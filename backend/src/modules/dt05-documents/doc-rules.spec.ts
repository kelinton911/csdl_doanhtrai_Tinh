import { BusinessException } from '../../common/errors/business-error';
import { assertTransition } from '../../common/enums/assert-transition';
import { DOCUMENT_TRANSITIONS, DocumentStatus } from '../../common/enums';
import { MovementType } from '../dt04-materiel/materiel-rules';
import {
  assertPeriodNotLocked,
  computeDiscrepancy,
  documentAffectsStock,
  isDateInLockedPeriod,
  movementTypeForDocument,
  reconcileMovementSum,
} from './doc-rules';
import { InventoryDocumentType, TRANSFER_TRANSITIONS, TransferStatus } from './dt05.enums';

describe('DT-05 doc-rules (Quyển V §II/§VIII)', () => {
  describe('ánh xạ chứng từ → movement DT-04', () => {
    it('nhập/xuất/thanh lý', () => {
      expect(movementTypeForDocument(InventoryDocumentType.RECEIPT)).toBe(MovementType.RECEIPT);
      expect(movementTypeForDocument(InventoryDocumentType.ISSUE)).toBe(MovementType.ISSUE);
      expect(movementTypeForDocument(InventoryDocumentType.DISPOSAL)).toBe(MovementType.ISSUE);
      expect(movementTypeForDocument(InventoryDocumentType.TRANSFER)).toBe(MovementType.TRANSFER_OUT);
    });
    it('RECALL không tự giảm HC (BR-DT05-014)', () => {
      expect(documentAffectsStock(InventoryDocumentType.RECALL)).toBe(false);
      expect(documentAffectsStock(InventoryDocumentType.ISSUE)).toBe(true);
    });
  });

  describe('máy trạng thái chứng từ (TC-DT05-003/005)', () => {
    it('POSTED không sửa/hủy trực tiếp — chỉ reversal', () => {
      expect(() => assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.POSTED, DocumentStatus.CANCELLED)).toThrow();
      expect(() => assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.POSTED, DocumentStatus.REVERSED)).not.toThrow();
    });
    it('hủy chỉ khi chưa POST', () => {
      expect(() => assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.DRAFT, DocumentStatus.CANCELLED)).not.toThrow();
      expect(() => assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.SUBMITTED, DocumentStatus.CANCELLED)).not.toThrow();
    });
    it('chuỗi hợp lệ tới POSTED', () => {
      expect(() => {
        assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.DRAFT, DocumentStatus.SUBMITTED);
        assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.SUBMITTED, DocumentStatus.UNDER_REVIEW);
        assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.UNDER_REVIEW, DocumentStatus.APPROVED);
        assertTransition(DOCUMENT_TRANSITIONS, DocumentStatus.APPROVED, DocumentStatus.POSTED);
      }).not.toThrow();
    });
  });

  describe('BR-DT05-010/013 khóa kỳ (TC-DT05-013)', () => {
    const locked = [{ from: '2026-01-01', to: '2026-03-31' }];
    it('backdate vào kỳ LOCKED → PERIOD_LOCKED', () => {
      expect(isDateInLockedPeriod('2026-02-15', locked)).toBe(true);
      expect.assertions(3);
      try {
        assertPeriodNotLocked('2026-02-15', locked);
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getCode()).toBe('PERIOD_LOCKED');
      }
    });
    it('ngoài kỳ khóa → hợp lệ', () => {
      expect(() => assertPeriodNotLocked('2026-04-10', locked)).not.toThrow();
    });
  });

  describe('BR-DT05-008/009 điều chuyển 2 đầu (TC-DT05-008/009)', () => {
    it('trạng thái transfer DRAFT→DISPATCHED→IN_TRANSIT→RECEIVED→CLOSED', () => {
      expect(() => {
        assertTransition(TRANSFER_TRANSITIONS, TransferStatus.DRAFT, TransferStatus.DISPATCHED);
        assertTransition(TRANSFER_TRANSITIONS, TransferStatus.DISPATCHED, TransferStatus.IN_TRANSIT);
        assertTransition(TRANSFER_TRANSITIONS, TransferStatus.IN_TRANSIT, TransferStatus.RECEIVED);
        assertTransition(TRANSFER_TRANSITIONS, TransferStatus.RECEIVED, TransferStatus.CLOSED);
      }).not.toThrow();
    });
    it('nhận lệch số → discrepancy', () => {
      expect(computeDiscrepancy(100, 100)).toEqual({ discrepancy: 0, hasDiscrepancy: false });
      expect(computeDiscrepancy(100, 95)).toEqual({ discrepancy: -5, hasDiscrepancy: true });
    });
  });

  describe('BR-DT05-026 đối chiếu Σmovement = Δbalance', () => {
    it('khớp → reconciled', () => {
      expect(reconcileMovementSum([100, -30, 50], 120).reconciled).toBe(true);
      expect(reconcileMovementSum([100, -30], 120).reconciled).toBe(false);
    });
  });
});
