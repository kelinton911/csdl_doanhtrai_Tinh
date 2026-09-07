import {
  CalculationScenarioStatus,
  ENGINE_VERSION,
  assertScenarioEditable,
  compareRuns,
  computeInputHash,
  computeMaterialNeed,
  computeOutputHash,
  determineLineStatus,
} from './calc-rules';
import { BusinessException } from '../../common/errors/business-error';

// Quy tắc miền DT-08 — hàm THUẦN (Quyển VIII §II/§VII). Không chạm DB.
describe('DT-08 calc-rules', () => {
  describe('computeMaterialNeed — công thức lõi NC = TT + PC_SSCĐ − HC', () => {
    it('TT = TT_GĐCB + TT_GĐCĐ, lưu riêng hai giai đoạn (BR-DT08-020, TC-DT08-020)', () => {
      const r = computeMaterialNeed({
        prep: { unitValue: 2, scale: 10, days: 3 }, // 60
        combat: { unitValue: 5, scale: 10, days: 2 }, // 100
        pcSscd: 0,
        hc: 0,
      });
      expect(r.ttGdcb).toBe(60);
      expect(r.ttGdcd).toBe(100);
      expect(r.tt).toBe(160);
      expect(r.ttGdcb + r.ttGdcd).toBe(r.tt);
    });

    it('NC = TT + PC_SSCĐ − HC; supply_required = max(NC,0)', () => {
      const r = computeMaterialNeed({
        prep: { unitValue: 1, scale: 100, days: 1 }, // 100
        combat: null,
        pcSscd: 50,
        hc: 30,
      });
      expect(r.tt).toBe(100);
      expect(r.nc).toBe(120); // 100 + 50 − 30
      expect(r.supplyRequired).toBe(120);
    });

    it('HC > TT + PC_SSCĐ → NC ÂM giữ nguyên dấu; supply_required = 0 (BR-DT08-004/006, TC-DT08-004)', () => {
      const r = computeMaterialNeed({
        prep: { unitValue: 1, scale: 10, days: 1 }, // 10
        combat: { unitValue: 1, scale: 10, days: 1 }, // 10
        pcSscd: 5, // TT+PC = 25
        hc: 100,
      });
      expect(r.tt).toBe(20);
      expect(r.nc).toBe(-75); // 25 − 100, GIỮ dấu âm
      expect(r.supplyRequired).toBe(0); // KHÔNG ghi 0 vào NC
      expect(r.nc).toBeLessThan(0);
    });

    it('giai đoạn null → đóng góp 0 (vật chất chỉ có 1 giai đoạn)', () => {
      const r = computeMaterialNeed({ prep: null, combat: { unitValue: 3, scale: 4, days: 2 }, pcSscd: 0, hc: 0 });
      expect(r.ttGdcb).toBe(0);
      expect(r.ttGdcd).toBe(24);
      expect(r.tt).toBe(24);
    });
  });

  describe('determineLineStatus — NO_RULE/CONFLICT KHÔNG quy 0 (BR-DT08-008)', () => {
    it('có CONFLICT → CONFLICT (ưu tiên cao nhất) (TC-DT08-008)', () => {
      expect(determineLineStatus(['SELECTED', 'CONFLICT'])).toBe('CONFLICT');
      expect(determineLineStatus(['NO_RULE', 'CONFLICT'])).toBe('CONFLICT');
    });
    it('có NO_RULE (không CONFLICT) → NO_RULE (TC-DT08-006)', () => {
      expect(determineLineStatus(['SELECTED', 'NO_RULE'])).toBe('NO_RULE');
    });
    it('tất cả SELECTED → SELECTED', () => {
      expect(determineLineStatus(['SELECTED', 'SELECTED'])).toBe('SELECTED');
    });
  });

  describe('hash tái lập (BR-DT08-016/017)', () => {
    const input = {
      scenarioCode: 'CS-1',
      scope: { org: 'O1', materials: [{ materialCatalogId: 'M1' }] },
      effectiveTime: '2026-06-01T00:00:00.000Z',
      engineVersion: ENGINE_VERSION,
      hcSnapshotId: 'SNAP-1',
    };

    it('cùng input → cùng input_hash (TC-DT08-016)', () => {
      expect(computeInputHash(input)).toBe(computeInputHash({ ...input }));
    });

    it('input_hash KHÔNG phụ thuộc thứ tự khóa trong scope', () => {
      const a = computeInputHash({ ...input, scope: { org: 'O1', a: 1, b: 2 } });
      const b = computeInputHash({ ...input, scope: { b: 2, a: 1, org: 'O1' } });
      expect(a).toBe(b);
    });

    it('cùng tập kết quả → cùng output_hash bất kể thứ tự vật chất (TC-DT08-016)', () => {
      const lineA = {
        materialCatalogId: 'M-A',
        ruleStatus: 'SELECTED' as const,
        hcStatus: 'OK' as const,
        ttGdcb: 1, ttGdcd: 2, tt: 3, pcSscd: 0, hc: 0, nc: 3, supplyRequired: 3,
      };
      const lineB = { ...lineA, materialCatalogId: 'M-B', nc: 5, supplyRequired: 5 };
      expect(computeOutputHash([lineA, lineB], ENGINE_VERSION)).toBe(computeOutputHash([lineB, lineA], ENGINE_VERSION));
    });

    it('đổi engine_version → đổi output_hash', () => {
      const line = {
        materialCatalogId: 'M-A', ruleStatus: 'SELECTED' as const, hcStatus: 'OK' as const,
        ttGdcb: 1, ttGdcd: 2, tt: 3, pcSscd: 0, hc: 0, nc: 3, supplyRequired: 3,
      };
      expect(computeOutputHash([line], ENGINE_VERSION)).not.toBe(computeOutputHash([line], 'other'));
    });
  });

  describe('compareRuns — ΔNC theo vật chất (SCR-DT08-06)', () => {
    it('ΔNC = NC(target) − NC(base); đánh dấu changed', () => {
      const base = [{ materialCatalogId: 'M1', nc: 100, supplyRequired: 100, ruleStatus: 'SELECTED' }];
      const target = [{ materialCatalogId: 'M1', nc: 120, supplyRequired: 120, ruleStatus: 'SELECTED' }];
      const [d] = compareRuns(base, target);
      expect(d.deltaNc).toBe(20);
      expect(d.deltaSupply).toBe(20);
      expect(d.changed).toBe(true);
    });
    it('vật chất chỉ có ở target → base null, changed', () => {
      const [d] = compareRuns([], [{ materialCatalogId: 'M2', nc: 5, supplyRequired: 5, ruleStatus: 'SELECTED' }]);
      expect(d.baseNc).toBeNull();
      expect(d.targetNc).toBe(5);
      expect(d.changed).toBe(true);
    });
    it('không đổi → changed=false', () => {
      const rows = [{ materialCatalogId: 'M1', nc: 10, supplyRequired: 10, ruleStatus: 'SELECTED' }];
      const [d] = compareRuns(rows, rows.map((r) => ({ ...r })));
      expect(d.deltaNc).toBe(0);
      expect(d.changed).toBe(false);
    });
  });

  describe('assertScenarioEditable — LOCKED bất biến (BR-DT08-011, TC-DT08-011)', () => {
    it('DRAFT/CALCULATED cho phép', () => {
      expect(() => assertScenarioEditable(CalculationScenarioStatus.DRAFT)).not.toThrow();
      expect(() => assertScenarioEditable(CalculationScenarioStatus.CALCULATED)).not.toThrow();
    });
    it('LOCKED/SUPERSEDED → BusinessException (buộc revise/clone)', () => {
      expect(() => assertScenarioEditable(CalculationScenarioStatus.LOCKED)).toThrow(BusinessException);
      expect(() => assertScenarioEditable(CalculationScenarioStatus.SUPERSEDED)).toThrow(BusinessException);
    });
  });
});
