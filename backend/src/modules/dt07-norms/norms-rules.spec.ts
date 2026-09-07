import { BusinessException } from '../../common/errors/business-error';
import { CatalogVersionStatus } from '../../common/enums';
import {
  CommandStatus,
  COMMAND_TRANSITIONS,
  DimensionType,
  NormCandidate,
  NormSourceStatus,
  NormValueType,
  ResolveRequestInput,
  assertNormSetEditable,
  resolveNorm,
  withinEffective,
} from './norms-rules';
import { assertTransition } from '../../common/enums/assert-transition';

// Ứng viên định mức mẫu: helper dựng nhanh.
function norm(over: Partial<NormCandidate>): NormCandidate {
  return {
    normId: 'n',
    materialCatalogId: 'MAT-1',
    semanticParam: 'CONSUMPTION_COMBAT',
    sourceStatus: NormSourceStatus.VERIFIED,
    valueType: NormValueType.FIXED,
    valueNumeric: 10,
    rawValue: '10 kg',
    unitId: 'U-KG',
    formulaExpr: null,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    issuingAuthority: null,
    dimensions: [],
    ...over,
  };
}

function req(over: Partial<ResolveRequestInput> = {}): ResolveRequestInput {
  return {
    materialCatalogId: 'MAT-1',
    semanticParam: 'CONSUMPTION_COMBAT',
    scope: {},
    asOf: new Date('2026-06-01'),
    ...over,
  };
}

describe('DT-07 norms-rules — bộ chọn định mức deterministic (Quyển VII §VII)', () => {
  describe('withinEffective (BR-DT07-016)', () => {
    it('trong khoảng hiệu lực → true; ngoài → false', () => {
      const asOf = new Date('2026-06-01');
      expect(withinEffective(asOf, '2026-01-01', null)).toBe(true);
      expect(withinEffective(asOf, '2026-01-01', '2026-12-31')).toBe(true);
      expect(withinEffective(asOf, '2026-07-01', null)).toBe(false); // chưa hiệu lực
      expect(withinEffective(asOf, '2026-01-01', '2026-05-31')).toBe(false); // đã hết
    });
  });

  describe('TC-DT07-007: đúng 1 match → SELECTED + trace', () => {
    it('trả SELECTED, có giá trị + trace giải thích', () => {
      const res = resolveNorm([norm({ normId: 'A', valueNumeric: 9 })], req());
      expect(res.status).toBe('SELECTED');
      expect(res.selected?.normId).toBe('A');
      expect(res.selected?.valueNumeric).toBe(9);
      expect(res.trace.considered).toHaveLength(1);
      expect(res.trace.decision).toContain('đặc thù');
    });
  });

  describe('TC-DT07-008: 2 định mức cùng độ ưu tiên → CONFLICT (không tự chọn)', () => {
    it('cùng độ đặc thù, không có authority_rank → CONFLICT', () => {
      const res = resolveNorm(
        [norm({ normId: 'A' }), norm({ normId: 'B' })],
        req(),
      );
      expect(res.status).toBe('CONFLICT');
      expect(res.selected).toBeUndefined();
      expect(res.candidateNormIds?.sort()).toEqual(['A', 'B']);
    });

    it('authority_rank tách được → SELECTED (BR-DT07-027)', () => {
      const res = resolveNorm(
        [
          norm({ normId: 'A', issuingAuthority: 'BTL' }),
          norm({ normId: 'B', issuingAuthority: 'CUC' }),
        ],
        req(),
        { BTL: 1, CUC: 2 },
      );
      expect(res.status).toBe('SELECTED');
      expect(res.selected?.normId).toBe('A');
      expect(res.trace.authorityRankApplied).toBe(true);
    });
  });

  describe('TC-DT07-009: không match → NO_RULE (không trả 0)', () => {
    it('khác vật chất → NO_RULE', () => {
      const res = resolveNorm([norm({ materialCatalogId: 'MAT-OTHER' })], req());
      expect(res.status).toBe('NO_RULE');
      expect(res.selected).toBeUndefined();
      expect(res.trace.decision).toContain('NO_RULE');
    });
    it('danh sách rỗng → NO_RULE', () => {
      expect(resolveNorm([], req()).status).toBe('NO_RULE');
    });
  });

  describe('most-specific-wins: nhiều chiều khớp thắng định mức tổng quát', () => {
    it('định mức có mission+phase khớp thắng định mức không chiều', () => {
      const general = norm({ normId: 'GEN', dimensions: [] });
      const specific = norm({
        normId: 'SPEC',
        dimensions: [
          { dimensionType: DimensionType.MISSION, dimensionValue: 'ATTACK' },
          { dimensionType: DimensionType.PHASE, dimensionValue: 'COMBAT' },
        ],
      });
      const res = resolveNorm(
        [general, specific],
        req({ scope: { mission: 'ATTACK', phase: 'COMBAT' } }),
      );
      expect(res.status).toBe('SELECTED');
      expect(res.selected?.normId).toBe('SPEC');
      expect(res.trace.maxSpecificity).toBe(2);
    });

    it('chiều khai báo không khớp bối cảnh → loại ứng viên', () => {
      const specific = norm({
        normId: 'SPEC',
        dimensions: [{ dimensionType: DimensionType.MISSION, dimensionValue: 'DEFENSE' }],
      });
      const res = resolveNorm([specific], req({ scope: { mission: 'ATTACK' } }));
      expect(res.status).toBe('NO_RULE');
      expect(res.trace.considered[0].eligible).toBe(false);
      expect(res.trace.considered[0].reason).toContain('MISSION');
    });
  });

  describe('TC-DT07-016: as_of sau khi hết hiệu lực → không áp', () => {
    it('định mức đã hết hiệu lực bị loại → NO_RULE', () => {
      const res = resolveNorm(
        [norm({ effectiveFrom: '2026-01-01', effectiveTo: '2026-03-31' })],
        req({ asOf: new Date('2026-06-01') }),
      );
      expect(res.status).toBe('NO_RULE');
      expect(res.trace.considered[0].reason).toContain('hết hiệu lực');
    });
  });

  describe('TC-DT07-026: LEGACY_UNVERIFIED không dùng cho resolve', () => {
    it('định mức thiếu căn cứ bị loại → NO_RULE + cảnh báo trace', () => {
      const res = resolveNorm(
        [norm({ sourceStatus: NormSourceStatus.LEGACY_UNVERIFIED })],
        req(),
      );
      expect(res.status).toBe('NO_RULE');
      expect(res.trace.considered[0].reason).toContain('LEGACY_UNVERIFIED');
    });
  });

  describe('TC-DT07-002: bộ định mức PUBLISHED bất biến', () => {
    it('sửa bộ PUBLISHED → LOCKED_IMMUTABLE', () => {
      expect.assertions(2);
      try {
        assertNormSetEditable(CatalogVersionStatus.PUBLISHED);
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getCode()).toBe('LOCKED_IMMUTABLE');
      }
    });
    it('bộ DRAFT/VALIDATED được sửa', () => {
      expect(() => assertNormSetEditable(CatalogVersionStatus.DRAFT)).not.toThrow();
      expect(() => assertNormSetEditable(CatalogVersionStatus.VALIDATED)).not.toThrow();
    });
  });

  describe('máy trạng thái Chỉ lệnh hậu cần', () => {
    it('DRAFT→ISSUED→IN_PROGRESS→COMPLETED hợp lệ', () => {
      expect(() => {
        assertTransition(COMMAND_TRANSITIONS, CommandStatus.DRAFT, CommandStatus.ISSUED);
        assertTransition(COMMAND_TRANSITIONS, CommandStatus.ISSUED, CommandStatus.IN_PROGRESS);
        assertTransition(COMMAND_TRANSITIONS, CommandStatus.IN_PROGRESS, CommandStatus.COMPLETED);
      }).not.toThrow();
    });
    it('DRAFT→COMPLETED trực tiếp không hợp lệ', () => {
      expect(() =>
        assertTransition(COMMAND_TRANSITIONS, CommandStatus.DRAFT, CommandStatus.COMPLETED),
      ).toThrow();
    });
  });
});
