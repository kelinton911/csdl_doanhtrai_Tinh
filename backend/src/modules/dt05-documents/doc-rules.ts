import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { MovementType } from '../dt04-materiel/materiel-rules';
import { InventoryDocumentType } from './dt05.enums';

// Quy tắc miền DT-05 (Quyển V §II/§VIII) — hàm THUẦN, kiểm thử trực tiếp.
// DT-05 KHÔNG giữ số dư; chỉ ánh xạ chứng từ → giao dịch DT-04.

// Ánh xạ loại chứng từ → loại movement DT-04 cho từng dòng.
// TRANSFER được xử lý 2 đầu qua transfer_order (dispatch=OUT, receive=IN) nên ở lớp
// chứng từ đơn, TRANSFER coi như xuất kho nguồn.
export function movementTypeForDocument(docType: InventoryDocumentType): MovementType {
  switch (docType) {
    case InventoryDocumentType.RECEIPT:
      return MovementType.RECEIPT;
    case InventoryDocumentType.ISSUE:
    case InventoryDocumentType.DISPOSAL:
      return MovementType.ISSUE;
    case InventoryDocumentType.TRANSFER:
      return MovementType.TRANSFER_OUT;
    case InventoryDocumentType.CONVERSION:
      return MovementType.ADJUSTMENT;
    case InventoryDocumentType.RECALL:
      // Thu hồi = đổi trạng thái tài sản, KHÔNG tự giảm HC (BR-DT05-014).
      return MovementType.ADJUSTMENT;
  }
}

// RECALL không sinh giao dịch giảm thực (chỉ đổi trạng thái) — BR-DT05-014.
export function documentAffectsStock(docType: InventoryDocumentType): boolean {
  return docType !== InventoryDocumentType.RECALL;
}

// ---- BR-DT05-010/013 (TC-DT05-013): cấm backdate vào kỳ đã LOCKED ----
export interface LockedPeriod {
  from: string; // ISO date
  to: string;
}
export function isDateInLockedPeriod(effectiveDate: string, locked: LockedPeriod[]): boolean {
  return locked.some((p) => effectiveDate >= p.from && effectiveDate <= p.to);
}
export function assertPeriodNotLocked(effectiveDate: string, locked: LockedPeriod[]): void {
  if (isDateInLockedPeriod(effectiveDate, locked)) {
    throw new BusinessException(
      BusinessError.PERIOD_LOCKED,
      `Không được ghi vào kỳ đã khóa (${effectiveDate})`,
    );
  }
}

// ---- BR-DT05-008/009 (TC-DT05-009): chênh lệch giao–nhận điều chuyển ----
export function computeDiscrepancy(dispatchedQty: number, receivedQty: number): {
  discrepancy: number;
  hasDiscrepancy: boolean;
} {
  const discrepancy = receivedQty - dispatchedQty;
  return { discrepancy, hasDiscrepancy: Math.abs(discrepancy) > 1e-9 };
}

// ---- BR-DT05-026 (TC): đối chiếu Σmovement = Δbalance ----
export function reconcileMovementSum(movementSigned: number[], deltaBalance: number): {
  ledgerSum: number;
  reconciled: boolean;
} {
  const ledgerSum = movementSigned.reduce((s, v) => s + (Number(v) || 0), 0);
  return { ledgerSum, reconciled: Math.abs(ledgerSum - deltaBalance) < 1e-6 };
}
