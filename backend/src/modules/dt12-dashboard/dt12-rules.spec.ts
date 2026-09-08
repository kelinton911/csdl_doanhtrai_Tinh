import { BusinessException } from '../../common/errors/business-error';
import { AlertInstanceStatus, AlertSeverity, DT12_ENGINE_VERSION, FreshnessStatus, ThresholdDirection } from './dt12.enums';
import {
  assertAlertTransition,
  computeMetricHash,
  evaluateThreshold,
  resolveFreshness,
  scoreOptions,
  slaDueAt,
  type MetricPayload,
} from './dt12-rules';

// DT-12 — unit test quy tắc thuần. Bám TC-DT12-006 (freshness STALE), TC-012 (severity theo ngưỡng),
// TC-015 (metric_hash tất định — mọi metric tái lập được), lifecycle cảnh báo, chấm điểm quyết định.
const base: MetricPayload = {
  engineVersion: DT12_ENGINE_VERSION,
  kpiCode: 'KPI-HC',
  semantic: 'SEM_HC',
  scope: {},
  asOf: '2026-09-08T00:00:00.000+07:00',
  value: 180,
  lineage: [{ sourceType: 'DT04_MATERIEL_SNAPSHOT', snapshotId: 's1', checksum: 'c1' }],
};

describe('computeMetricHash — tất định (cùng nội dung ⇒ cùng hash; đổi value ⇒ khác)', () => {
  it('cùng payload ⇒ cùng hash, độ dài 64', () => {
    const h1 = computeMetricHash(base);
    const h2 = computeMetricHash({ ...base, lineage: [...base.lineage] });
    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
  });
  it('đổi value ⇒ đổi hash', () => {
    expect(computeMetricHash({ ...base, value: 181 })).not.toBe(computeMetricHash(base));
  });
  it('đổi asOf ⇒ đổi hash (phân biệt mốc thời gian)', () => {
    expect(computeMetricHash({ ...base, asOf: '2026-09-09T00:00:00.000+07:00' })).not.toBe(computeMetricHash(base));
  });
});

describe('resolveFreshness (TC-DT12-006)', () => {
  it('cùng version ⇒ FRESH', () => {
    expect(resolveFreshness('v1', 'v1')).toBe(FreshnessStatus.FRESH);
  });
  it('nguồn có version mới hơn ⇒ STALE', () => {
    expect(resolveFreshness('v1', 'v2')).toBe(FreshnessStatus.STALE);
  });
  it('không có nguồn nào ⇒ NO_SOURCE', () => {
    expect(resolveFreshness(null, null)).toBe(FreshnessStatus.NO_SOURCE);
  });
  it('metric chưa có version nhưng nguồn có ⇒ STALE', () => {
    expect(resolveFreshness(null, 'v2')).toBe(FreshnessStatus.STALE);
  });
});

describe('evaluateThreshold (TC-DT12-012 — severity đúng theo hướng)', () => {
  const higher = { warnLevel: 5, criticalLevel: 8, direction: ThresholdDirection.HIGHER_WORSE };
  it('GAP=10 (HIGHER_WORSE, ≥ critical 8) ⇒ CRITICAL', () => {
    expect(evaluateThreshold(10, higher)).toBe(AlertSeverity.CRITICAL);
  });
  it('GAP=6 (≥ warn 5, < critical 8) ⇒ WARN', () => {
    expect(evaluateThreshold(6, higher)).toBe(AlertSeverity.WARN);
  });
  it('GAP=3 (< warn) ⇒ null (không cảnh báo)', () => {
    expect(evaluateThreshold(3, higher)).toBeNull();
  });
  const lower = { warnLevel: 200, criticalLevel: 100, direction: ThresholdDirection.LOWER_WORSE };
  it('HC-AVAILABLE=150 (LOWER_WORSE, ≤ warn 200, > critical 100) ⇒ WARN', () => {
    expect(evaluateThreshold(150, lower)).toBe(AlertSeverity.WARN);
  });
  it('HC-AVAILABLE=90 (≤ critical 100) ⇒ CRITICAL', () => {
    expect(evaluateThreshold(90, lower)).toBe(AlertSeverity.CRITICAL);
  });
  it('value null (NO_DATA) ⇒ null (không quy 0, không cảnh báo)', () => {
    expect(evaluateThreshold(null, higher)).toBeNull();
  });
});

describe('assertAlertTransition (OPEN→ACK→RESOLVED; RESOLVED bất biến)', () => {
  it('OPEN → ACK hợp lệ', () => {
    expect(() => assertAlertTransition(AlertInstanceStatus.OPEN, AlertInstanceStatus.ACK)).not.toThrow();
  });
  it('OPEN → RESOLVED hợp lệ', () => {
    expect(() => assertAlertTransition(AlertInstanceStatus.OPEN, AlertInstanceStatus.RESOLVED)).not.toThrow();
  });
  it('ACK → OPEN không hợp lệ', () => {
    expect(() => assertAlertTransition(AlertInstanceStatus.ACK, AlertInstanceStatus.OPEN)).toThrow(BusinessException);
  });
  it('RESOLVED → bất kỳ ⇒ LOCKED_IMMUTABLE', () => {
    try {
      assertAlertTransition(AlertInstanceStatus.RESOLVED, AlertInstanceStatus.ACK);
      fail('phải ném');
    } catch (e) {
      expect((e as BusinessException).getCode()).toBe('LOCKED_IMMUTABLE');
    }
  });
});

describe('slaDueAt', () => {
  it('cộng đúng số giờ', () => {
    const asOf = new Date('2026-09-08T00:00:00.000Z');
    expect(slaDueAt(asOf, 48).toISOString()).toBe('2026-09-10T00:00:00.000Z');
  });
});

describe('scoreOptions — chuẩn hóa min-max + trọng số + xếp hạng', () => {
  it('HIGHER_BETTER: giá trị cao ⇒ điểm cao; xếp hạng đúng', () => {
    const scores = [
      { optionId: 'A', criterionId: 'c1', rawValue: 100 },
      { optionId: 'B', criterionId: 'c1', rawValue: 50 },
    ];
    const crits = [{ criterionId: 'c1', weight: 2, direction: 'HIGHER_BETTER' as const }];
    const { rows, ranking } = scoreOptions(scores, crits);
    const a = rows.find((r) => r.optionId === 'A')!;
    const b = rows.find((r) => r.optionId === 'B')!;
    expect(a.normalized).toBe(1);
    expect(b.normalized).toBe(0);
    expect(a.weighted).toBe(2);
    expect(ranking[0].optionId).toBe('A');
  });
  it('LOWER_BETTER: giá trị thấp ⇒ điểm cao', () => {
    const scores = [
      { optionId: 'A', criterionId: 'gap', rawValue: 10 },
      { optionId: 'B', criterionId: 'gap', rawValue: 2 },
    ];
    const crits = [{ criterionId: 'gap', weight: 1, direction: 'LOWER_BETTER' as const }];
    const { ranking } = scoreOptions(scores, crits);
    expect(ranking[0].optionId).toBe('B'); // GAP thấp hơn ⇒ tốt hơn
  });
  it('rawValue null ⇒ normalized/weighted null (không quy 0)', () => {
    const { rows } = scoreOptions(
      [{ optionId: 'A', criterionId: 'c1', rawValue: null }],
      [{ criterionId: 'c1', weight: 1, direction: 'HIGHER_BETTER' }],
    );
    expect(rows[0].normalized).toBeNull();
    expect(rows[0].weighted).toBeNull();
  });
});
