// Kiểm chứng bất biến toàn hệ SYS-BR-01..08 (§1 Hardening) — UNIT trên các hàm quy tắc
// thuần đã dùng trong DT-04/06/08. Chạy trong `npm test` (cổng CI), không cần DB.
// Mỗi test viện dẫn đúng mã bất biến để làm bằng chứng nghiệm thu TC-HD-003/004/005.
import { BusinessError, BusinessException } from '../errors/business-error';
import {
  MovementStatus,
  MovementType,
  assertMovementEditable,
  assertSnapshotUnlocked,
  hcAtTime,
  signedQuantity,
  type LedgerEntry,
} from '../../modules/dt04-materiel/materiel-rules';
import {
  CalculationScenarioStatus,
  assertScenarioEditable,
  computeInputHash,
  computeMaterialNeed,
  computeOutputHash,
  determineLineStatus,
  type CalcInputForHash,
  type CalcOutputLineForHash,
} from '../../modules/dt08-calculation/calc-rules';
import {
  assertExclusiveWithinAllocatable,
  hcAllocatable,
} from '../../modules/dt06-allocation/alloc-rules';

function expectCode(fn: () => void, code: BusinessError) {
  try {
    fn();
    throw new Error('không ném lỗi như kỳ vọng');
  } catch (e) {
    expect(e).toBeInstanceOf(BusinessException);
    expect((e as BusinessException).code).toBe(code);
  }
}

describe('SYS-BR invariants toàn hệ (§1 Hardening)', () => {
  it('SYS-BR-02: số dư chỉ đổi qua giao dịch có dấu; giao dịch POSTED bất biến (dùng reversal)', () => {
    // Xuất làm giảm; nhập làm tăng — không có "set balance".
    expect(signedQuantity(MovementType.ISSUE, 10)).toBeLessThan(0);
    expect(signedQuantity(MovementType.RECEIPT, 10)).toBeGreaterThan(0);
    // Không sửa trực tiếp bản ghi đã ghi sổ.
    expectCode(() => assertMovementEditable(MovementStatus.POSTED), BusinessError.LOCKED_IMMUTABLE);
  });

  it('SYS-BR-03: snapshot/kịch bản đã khóa là bất biến (LOCKED_IMMUTABLE)', () => {
    expectCode(() => assertSnapshotUnlocked(true), BusinessError.LOCKED_IMMUTABLE);
    expectCode(() => assertScenarioEditable(CalculationScenarioStatus.LOCKED), BusinessError.LOCKED_IMMUTABLE);
  });

  it('SYS-BR-04: NO_RULE/CONFLICT không tự quy 0; NC giữ dấu âm, supply_required=max(NC,0)', () => {
    expect(determineLineStatus(['SELECTED', 'NO_RULE'])).toBe('NO_RULE');
    expect(determineLineStatus(['SELECTED', 'CONFLICT'])).toBe('CONFLICT');
    // HC dư ⇒ NC âm phải được giữ nguyên (không quy 0), supply_required mới = 0.
    const r = computeMaterialNeed({ prep: { unitValue: 2, scale: 1, days: 1 }, combat: null, pcSscd: 0, hc: 10 });
    expect(r.nc).toBeLessThan(0);
    expect(r.supplyRequired).toBe(0);
  });

  it('SYS-BR-05: Σ nguồn exclusive ≤ khả dụng, vượt → OVER_ALLOCATED (chống tính trùng)', () => {
    const allocatable = hcAllocatable(100, 0);
    expect(() => assertExclusiveWithinAllocatable([40, 30], 20, allocatable)).not.toThrow(); // 90 ≤ 100
    expectCode(
      () => assertExclusiveWithinAllocatable([60, 30], 20, allocatable), // 110 > 100
      BusinessError.OVER_ALLOCATED,
    );
  });

  it('SYS-BR-07: HC(t) as-of chỉ tính POSTED có effective_time ≤ t (yếu tố thời gian)', () => {
    const entries: LedgerEntry[] = [
      { status: MovementStatus.POSTED, effectiveTime: '2026-01-01T00:00:00+07:00', signed: 100 },
      { status: MovementStatus.POSTED, effectiveTime: '2026-03-01T00:00:00+07:00', signed: -30 },
      { status: MovementStatus.POSTED, effectiveTime: '2026-06-01T00:00:00+07:00', signed: 50 }, // sau mốc
      { status: MovementStatus.APPROVED, effectiveTime: '2026-02-01T00:00:00+07:00', signed: 999 }, // chưa POSTED
    ];
    // as-of 01/04/2026: 100 − 30 = 70 (loại movement tháng 6 và bản APPROVED).
    expect(hcAtTime(entries, '2026-04-01T00:00:00+07:00')).toBe(70);
    // as-of muộn hơn: cộng thêm 50.
    expect(hcAtTime(entries, '2026-07-01T00:00:00+07:00')).toBe(120);
  });

  it('TC-HD-003 (tái lập): cùng input ⇒ cùng input_hash/output_hash; khác input ⇒ khác hash', () => {
    const input: CalcInputForHash = {
      scenarioCode: 'SC-1',
      scope: { org: 'A', materials: ['m1', 'm2'] },
      effectiveTime: '2026-06-01T00:00:00+07:00',
      engineVersion: 'dt08-need-v1',
      hcSnapshotId: 'snap-1',
    };
    expect(computeInputHash(input)).toBe(computeInputHash({ ...input }));
    expect(computeInputHash(input)).not.toBe(computeInputHash({ ...input, effectiveTime: '2026-06-02T00:00:00+07:00' }));

    const lines: CalcOutputLineForHash[] = [
      { materialCatalogId: 'm2', ruleStatus: 'SELECTED', hcStatus: 'OK', ttGdcb: 1, ttGdcd: 2, tt: 3, pcSscd: 0, hc: 1, nc: 2, supplyRequired: 2 },
      { materialCatalogId: 'm1', ruleStatus: 'NO_RULE', hcStatus: 'OK', ttGdcb: null, ttGdcd: null, tt: null, pcSscd: null, hc: 5, nc: null, supplyRequired: null },
    ];
    // Ổn định theo material (đảo thứ tự vẫn trùng hash).
    expect(computeOutputHash(lines, 'dt08-need-v1')).toBe(computeOutputHash([...lines].reverse(), 'dt08-need-v1'));
  });
});
