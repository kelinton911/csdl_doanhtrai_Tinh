import { resolveAsOf, toHcmIso } from './as-of';
import { asOfResponse } from '../dto/as-of-response';
import { buildScopeContext } from '../scope/scope-context';
import { Role } from '../../modules/identity/roles';

describe('as-of helper (Sprint 0 §1 GAP-5, TC-S0-005)', () => {
  it('không truyền → thời điểm hiện tại', () => {
    const before = Date.now();
    const d = resolveAsOf();
    expect(d.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('parse ISO hợp lệ', () => {
    const d = resolveAsOf('2026-09-06T10:00:00Z');
    expect(d.toISOString()).toBe('2026-09-06T10:00:00.000Z');
  });

  it('ISO không hợp lệ → ném lỗi VAL', () => {
    expect(() => resolveAsOf('không-phải-ngày')).toThrow(/as_of_time/);
  });

  it('toHcmIso trả hậu tố +07:00 và cộng đúng 7 giờ', () => {
    // 03:00Z = 10:00 giờ VN.
    expect(toHcmIso(new Date('2026-09-06T03:00:00Z'))).toBe('2026-09-06T10:00:00+07:00');
  });

  it('response wrapper kèm as_of_time/scope/source/locked', () => {
    const scope = buildScopeContext({
      sub: 'u',
      username: 'u',
      roles: [Role.PROVINCIAL_COMMAND],
      organizationId: 'org-1',
    });
    const wrapped = asOfResponse({ hc: 12 }, {
      asOf: new Date('2026-09-06T03:00:00Z'),
      source: 'snapshot',
      locked: true,
      scope,
    });
    expect(wrapped.data).toEqual({ hc: 12 });
    expect(wrapped.meta.as_of_time).toBe('2026-09-06T10:00:00+07:00');
    expect(wrapped.meta.source).toBe('snapshot');
    expect(wrapped.meta.locked).toBe(true);
    expect(wrapped.meta.scope.provinceWide).toBe(true);
  });
});
