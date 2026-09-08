import { createHash } from 'crypto';

// Hash tất định dùng chung (checksum snapshot, fingerprint nguồn…). Cùng input ⇒ cùng hash,
// không phụ thuộc thứ tự khóa object. DT-08 (calc-rules) có bản sao cục bộ; module mới dùng ở đây.

// Chuỗi hóa ổn định: khóa object sắp xếp để hash không phụ thuộc thứ tự.
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function sha256Hex(input: unknown): string {
  return createHash('sha256').update(stableStringify(input)).digest('hex');
}
