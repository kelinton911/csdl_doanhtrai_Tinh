import { classifyDq, skippedDq, summarizeDq } from './data-quality.rules';

describe('data-quality rules (§6)', () => {
  it('classifyDq: PASS khi 0 vi phạm; nghiêm trọng theo cấu hình khi >0', () => {
    expect(classifyDq('NEG', 'x', 0, 'FAIL').status).toBe('PASS');
    expect(classifyDq('NEG', 'x', 3, 'FAIL').status).toBe('FAIL');
    expect(classifyDq('SOFT', 'y', 2, 'WARN').status).toBe('WARN');
  });

  it('summarizeDq: FAIL trội hơn WARN; đếm skipped', () => {
    const checks = [
      classifyDq('A', 'a', 0, 'FAIL'), // PASS
      classifyDq('B', 'b', 5, 'WARN'), // WARN
      skippedDq('C', 'c', 'no table'), // SKIPPED
    ];
    let s = summarizeDq(checks);
    expect(s.status).toBe('WARN');
    expect(s.warned).toBe(1);
    expect(s.skipped).toBe(1);

    checks.push(classifyDq('D', 'd', 1, 'FAIL')); // FAIL
    s = summarizeDq(checks);
    expect(s.status).toBe('FAIL');
    expect(s.failed).toBe(1);
    expect(s.total).toBe(4);
  });
});
