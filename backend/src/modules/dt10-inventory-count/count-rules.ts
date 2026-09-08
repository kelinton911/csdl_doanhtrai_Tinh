import { BusinessError, BusinessException } from '../../common/errors/business-error';
import { sha256Hex } from '../../common/crypto/stable-hash';
import { VarianceType } from './dt10.enums';

// Hàm nghiệp vụ THUẦN của DT-10 (không I/O) — dễ kiểm thử đơn vị (count-rules.spec.ts).
// Sai số cho numeric(18,3): so sánh số lượng theo epsilon nhỏ để tránh nhiễu dấu phẩy động.
const EPS = 1e-6;

export function qtyEquals(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

// Phân loại chênh lệch giữa sổ sách (book) và thực đếm (physical) — BR-DT10-013..015.
// - Không có dòng sổ (hasBook=false) mà thực > 0 → UNBOOKED (có thực không sổ).
// - Có sổ nhưng thực = 0 → MISSING (mất/không tìm thấy thực).
// - Thực < sổ → SHORTAGE (thiếu); thực > sổ → SURPLUS (thừa).
// - locationMismatch=true (cùng vật chất, khác kho so với sổ) → LOCATION (ưu tiên gắn nhãn vị trí).
// Trả null khi khớp (không sinh variance).
export function classifyVariance(
  bookQty: number,
  physicalQty: number,
  hasBook: boolean,
  locationMismatch = false,
): VarianceType | null {
  if (locationMismatch) return VarianceType.LOCATION;
  if (!hasBook) return physicalQty > EPS ? VarianceType.UNBOOKED : null;
  if (qtyEquals(bookQty, physicalQty)) return null;
  if (physicalQty <= EPS) return VarianceType.MISSING;
  return physicalQty < bookQty ? VarianceType.SHORTAGE : VarianceType.SURPLUS;
}

export function sumGrades(grades: number[]): number {
  return grades.reduce((s, g) => s + (Number.isFinite(g) ? g : 0), 0);
}

// Kiểm kê chất lượng C1–5: Σ cấp chất lượng phải = số thực đếm khi bắt buộc (BR-DT10-009).
// Lệch → ném QUALITY_TOTAL_MISMATCH (422).
export function assertQualityTotal(grades: number[], physicalQty: number): void {
  const total = sumGrades(grades);
  if (!qtyEquals(total, physicalQty)) {
    throw new BusinessException(
      BusinessError.QUALITY_TOTAL_MISMATCH,
      `Σ chất lượng (${total}) ≠ số thực đếm (${physicalQty})`,
    );
  }
}

// Chuẩn hóa 1 dòng để tính checksum tất định (không phụ thuộc thứ tự khóa/bản ghi).
function normalizeLine(l: {
  materialCatalogId: string;
  lotId?: string | null;
  locationId?: string | null;
  organizationId?: string | null;
  qty: number | string;
  grade1?: number | string;
  grade2?: number | string;
  grade3?: number | string;
  grade4?: number | string;
  grade5?: number | string;
}) {
  return {
    material: l.materialCatalogId,
    lot: l.lotId ?? null,
    location: l.locationId ?? null,
    org: l.organizationId ?? null,
    qty: Number(l.qty),
    g1: Number(l.grade1 ?? 0),
    g2: Number(l.grade2 ?? 0),
    g3: Number(l.grade3 ?? 0),
    g4: Number(l.grade4 ?? 0),
    g5: Number(l.grade5 ?? 0),
  };
}

// Checksum bất biến của book_snapshot (BR-DT10-002/003): sắp xếp dòng trước khi hash để ổn định.
export function bookSnapshotChecksum(
  lines: Parameters<typeof normalizeLine>[0][],
  asOf: Date | string,
): string {
  const norm = lines.map(normalizeLine).sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  return sha256Hex({ kind: 'book_snapshot', asOf: new Date(asOf).toISOString(), lines: norm });
}

// Checksum official_snapshot gắn version (BR-DT10-019/020): revision đổi version ⇒ đổi checksum.
export function officialSnapshotChecksum(
  lines: Parameters<typeof normalizeLine>[0][],
  version: number,
): string {
  const norm = lines.map(normalizeLine).sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  return sha256Hex({ kind: 'official_snapshot', version, lines: norm });
}

function keyOf(n: { material: string; lot: string | null; location: string | null; org: string | null }): string {
  return `${n.material}|${n.lot ?? ''}|${n.location ?? ''}|${n.org ?? ''}`;
}
