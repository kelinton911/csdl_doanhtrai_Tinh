import {
  CellState,
  ReportInstanceStatus,
  SubmissionStatus,
  ValidationStatus,
} from './dt11.enums';
import {
  aggregateRollup,
  assertReportTransition,
  cellStateOf,
  computeDatasetHash,
  computeSourceFingerprint,
  evalFormula,
  isBlockingValidation,
  validateCompleteness,
  validateQualityTotal,
  validateReconciliation,
  type DatasetPayload,
} from './report-rules';
import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { REPORT_ENGINE_VERSION } from './dt11.enums';

const cell = (value: number | null) => ({ value, state: cellStateOf(value) });

function payload(rows: Array<{ key: string; total: number | null; grades?: number[] }>, sourceTotal?: number): DatasetPayload {
  return {
    engineVersion: REPORT_ENGINE_VERSION,
    formCode: '03/KK',
    generatedAt: new Date().toISOString(),
    sourceTotals: sourceTotal === undefined ? {} : { total: sourceTotal },
    rows: rows.map((r) => ({
      key: r.key,
      cells: {
        total: cell(r.total),
        ...(r.grades
          ? { c1: cell(r.grades[0]), c2: cell(r.grades[1]), c3: cell(r.grades[2]), c4: cell(r.grades[3]), c5: cell(r.grades[4]) }
          : {}),
      },
    })),
  };
}

describe('DT-11 report-rules (thuần)', () => {
  describe('cellStateOf — NO_DATA ≠ ZERO ≠ VALUE', () => {
    it('null → NO_DATA; 0 → ZERO; khác → VALUE', () => {
      expect(cellStateOf(null)).toBe(CellState.NO_DATA);
      expect(cellStateOf(0)).toBe(CellState.ZERO);
      expect(cellStateOf(12)).toBe(CellState.VALUE);
    });
  });

  describe('evalFormula — an toàn (+ - * / ())', () => {
    it('tổng cấp chất lượng', () => {
      expect(evalFormula('c1+c2+c3+c4+c5', { c1: 1, c2: 2, c3: 3, c4: 4, c5: 5 })).toBe(15);
    });
    it('thiếu biến → null (không quy 0)', () => {
      expect(evalFormula('a+b', { a: 5 })).toBeNull();
    });
    it('ưu tiên toán tử & ngoặc', () => {
      expect(evalFormula('(a+b)*c', { a: 2, b: 3, c: 4 })).toBe(20);
    });
  });

  describe('TC-DT11-006 — sinh lại dataset cùng nguồn ⇒ dataset_hash TRÙNG', () => {
    it('hash bỏ generatedAt: cùng nội dung ⇒ trùng, khác thời điểm ⇒ vẫn trùng', () => {
      const p1 = payload([{ key: 'm1', total: 10 }], 10);
      const p2: DatasetPayload = { ...p1, generatedAt: new Date(Date.now() + 100000).toISOString() };
      expect(computeDatasetHash(p1)).toBe(computeDatasetHash(p2));
    });
    it('khác nội dung ⇒ khác hash', () => {
      expect(computeDatasetHash(payload([{ key: 'm1', total: 10 }], 10))).not.toBe(
        computeDatasetHash(payload([{ key: 'm1', total: 11 }], 11)),
      );
    });
    it('source_fingerprint đổi khi upstreamHash đổi', () => {
      const ref = { sourceType: 'DT10_OFFICIAL_SNAPSHOT', campaignId: 'c1' };
      expect(computeSourceFingerprint(ref, 'hashA')).not.toBe(computeSourceFingerprint(ref, 'hashB'));
    });
  });

  describe('TC-DT11-007 — dataset lệch reconciliation ⇒ FAIL, chặn phê duyệt', () => {
    it('Σ dataset ≠ tổng nguồn ⇒ FAIL (blocking)', () => {
      const r = validateReconciliation(payload([{ key: 'm1', total: 10 }, { key: 'm2', total: 5 }], 20));
      expect(r.status).toBe(ValidationStatus.FAIL);
      expect(isBlockingValidation([r])).toBe(true);
    });
    it('khớp ⇒ PASS', () => {
      const r = validateReconciliation(payload([{ key: 'm1', total: 10 }, { key: 'm2', total: 5 }], 15));
      expect(r.status).toBe(ValidationStatus.PASS);
    });
    it('NO_DATA không bị quy 0 khi cộng', () => {
      const r = validateReconciliation(payload([{ key: 'm1', total: 10 }, { key: 'm2', total: null }], 10));
      expect(r.status).toBe(ValidationStatus.PASS);
    });
  });

  describe('quality total — Σ cấp chất lượng = tổng số', () => {
    it('lệch ⇒ FAIL', () => {
      const r = validateQualityTotal(payload([{ key: 'm1', total: 10, grades: [1, 2, 3, 1, 1] }]));
      expect(r.status).toBe(ValidationStatus.FAIL);
    });
    it('khớp ⇒ PASS', () => {
      const r = validateQualityTotal(payload([{ key: 'm1', total: 10, grades: [2, 2, 2, 2, 2] }]));
      expect(r.status).toBe(ValidationStatus.PASS);
    });
  });

  describe('completeness — NO_DATA ⇒ WARN (không quy 0)', () => {
    it('có ô NO_DATA ⇒ WARN, không FAIL', () => {
      const r = validateCompleteness(payload([{ key: 'm1', total: null }]));
      expect(r.status).toBe(ValidationStatus.WARN);
      expect(isBlockingValidation([r])).toBe(false);
    });
  });

  describe('TC-DT11-009/021 — rollup: MISSING ≠ 0 & chống aggregate trùng', () => {
    it('MISSING không cộng như 0, giữ trong missingOrgIds', () => {
      const res = aggregateRollup([
        { childOrgId: 'A', submissionStatus: SubmissionStatus.SUBMITTED, totals: { total: 100 } },
        { childOrgId: 'B', submissionStatus: SubmissionStatus.MISSING, totals: {} },
      ]);
      expect(res.aggregatedTotals.total).toBe(100);
      expect(res.missingOrgIds).toEqual(['B']);
      expect(res.submittedOrgIds).toEqual(['A']);
    });
    it('rollup 2 lần cùng đơn vị con ⇒ chỉ cộng 1 lần (idempotent)', () => {
      const res = aggregateRollup([
        { childOrgId: 'A', submissionStatus: SubmissionStatus.SUBMITTED, totals: { total: 100 } },
        { childOrgId: 'A', submissionStatus: SubmissionStatus.SUBMITTED, totals: { total: 100 } },
      ]);
      expect(res.aggregatedTotals.total).toBe(100);
      expect(res.submittedOrgIds).toEqual(['A']);
    });
  });

  describe('transition — ISSUED bất biến (LOCKED_IMMUTABLE)', () => {
    it('DRAFT → VALIDATED hợp lệ', () => {
      expect(() => assertReportTransition(ReportInstanceStatus.DRAFT, ReportInstanceStatus.VALIDATED)).not.toThrow();
    });
    it('sửa bản ISSUED ⇒ LOCKED_IMMUTABLE', () => {
      try {
        assertReportTransition(ReportInstanceStatus.ISSUED, ReportInstanceStatus.DRAFT);
        fail('phải ném lỗi');
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).getCode()).toBe(BusinessError.LOCKED_IMMUTABLE);
      }
    });
  });
});
