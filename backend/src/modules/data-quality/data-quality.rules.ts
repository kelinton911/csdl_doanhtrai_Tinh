// Quy tắc thuần cho kiểm tra chất lượng dữ liệu toàn hệ (§6 Hardening).
// Tách khỏi truy vấn DB để unit-test được.

export type DqStatus = 'PASS' | 'WARN' | 'FAIL' | 'SKIPPED';

export interface DqCheck {
  code: string; // mã kiểm tra (SCREAMING_SNAKE_CASE)
  title: string;
  status: DqStatus;
  count: number; // số bản ghi vi phạm (>=0); -1 khi SKIPPED
  detail?: string;
}

export interface DqSummary {
  status: DqStatus; // tổng hợp: FAIL nếu có FAIL, else WARN nếu có WARN, else PASS
  failed: number;
  warned: number;
  skipped: number;
  total: number;
}

// Phân loại 1 kiểm tra theo số vi phạm + mức nghiêm trọng khi vi phạm.
// severityWhenViolated: 'FAIL' cho bất biến cứng (vd tồn âm), 'WARN' cho cảnh báo mềm.
export function classifyDq(
  code: string,
  title: string,
  count: number,
  severityWhenViolated: 'FAIL' | 'WARN',
): DqCheck {
  const status: DqStatus = count > 0 ? severityWhenViolated : 'PASS';
  return { code, title, status, count };
}

export function skippedDq(code: string, title: string, detail: string): DqCheck {
  return { code, title, status: 'SKIPPED', count: -1, detail };
}

// Tổng hợp trạng thái toàn hệ từ danh sách kiểm tra.
export function summarizeDq(checks: DqCheck[]): DqSummary {
  const failed = checks.filter((c) => c.status === 'FAIL').length;
  const warned = checks.filter((c) => c.status === 'WARN').length;
  const skipped = checks.filter((c) => c.status === 'SKIPPED').length;
  const status: DqStatus = failed > 0 ? 'FAIL' : warned > 0 ? 'WARN' : 'PASS';
  return { status, failed, warned, skipped, total: checks.length };
}
