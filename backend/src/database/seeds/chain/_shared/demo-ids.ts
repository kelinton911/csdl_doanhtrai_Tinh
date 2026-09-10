// Hằng số DÙNG CHUNG cho bộ seed "chuỗi vàng" 00→12 (anchor Tỉnh Thanh Hóa, mã '38').
// Mọi phân hệ tra cứu entity thượng nguồn theo các mã/ID tất định ở đây ⇒ dữ liệu NỐI LIỀN
// xuyên phân hệ (không còn UUID island rời như seed-*-dt10/11/12 cũ). Idempotent theo mã.
//
// Nguyên tắc:
//  - material_catalog.id là PK thật ⇒ đặt UUID cố định để DT-03..DT-12 tham chiếu ổn định.
//  - organization/administrative_area.id do DB sinh ⇒ tra theo CODE tất định lúc chạy
//    (DV-38, DV-<mã xã>, area.code) — xem helper bên dưới.
//  - Các entity chuỗi khác (snapshot/campaign/scenario/plan…) tra theo CODE tất định.
import { DataSource } from 'typeorm';

// ---- Địa bàn gốc ----
export const PROVINCE_AREA_CODE = '38'; // Tỉnh Thanh Hóa (administrative_areas.code)
export const PROVINCE_ORG_CODE = 'DV-38'; // Bộ CHQS tỉnh Thanh Hoá (organizations.code)

// Xã/phường đại diện mang "spine sâu" DT-04→DT-12 (mã area THẬT trong CSDL).
// Nếu mã nào không tồn tại trên DB đích, helper sẽ bù bằng xã khác (ổn định theo code).
export const PREFERRED_COMMUNE_CODES = ['14797', '14812', '14845', '14869'];

// ---- DT-01: danh mục R00 doanh trại ----
export const CATALOG_VERSION_ID = '00000000-0000-0000-0000-0000000c0001';
export const CATALOG_VERSION_CODE = 'R00-DT-TH-2026';

// Bộ vật chất mẫu (id cố định). code là mã R00 nhánh doanh cụ/nhà ăn/vật liệu.
export interface DemoMaterial {
  id: string;
  code: string;
  name: string;
  unit: string; // mã unit_of_measure
  price: number; // đơn giá (đồng) để tính value biểu 02/KK
}
export const MATERIALS: DemoMaterial[] = [
  { id: '00000000-0000-0000-0000-0000000c0101', code: 'R00.01.01', name: 'Bàn làm việc', unit: 'CAI', price: 850000 },
  { id: '00000000-0000-0000-0000-0000000c0102', code: 'R00.01.02', name: 'Ghế tựa', unit: 'CAI', price: 320000 },
  { id: '00000000-0000-0000-0000-0000000c0103', code: 'R00.01.03', name: 'Giường cá nhân', unit: 'CAI', price: 1250000 },
  { id: '00000000-0000-0000-0000-0000000c0104', code: 'R00.01.04', name: 'Tủ đựng quân tư trang', unit: 'CAI', price: 1450000 },
  { id: '00000000-0000-0000-0000-0000000c0105', code: 'R00.01.05', name: 'Giá súng', unit: 'CAI', price: 980000 },
  { id: '00000000-0000-0000-0000-0000000c0106', code: 'R00.02.01', name: 'Bàn ăn', unit: 'CAI', price: 1650000 },
  { id: '00000000-0000-0000-0000-0000000c0107', code: 'R00.02.02', name: 'Ghế băng', unit: 'CAI', price: 420000 },
  { id: '00000000-0000-0000-0000-0000000c0108', code: 'R00.02.03', name: 'Tủ đựng bát đũa', unit: 'CAI', price: 1100000 },
  { id: '00000000-0000-0000-0000-0000000c0109', code: 'R00.03.01', name: 'Sơn chống thấm', unit: 'KG', price: 65000 },
  { id: '00000000-0000-0000-0000-0000000c010a', code: 'R00.03.02', name: 'Xi măng', unit: 'KG', price: 2200 },
  { id: '00000000-0000-0000-0000-0000000c010b', code: 'R00.03.03', name: 'Tôn lợp mái', unit: 'M2', price: 185000 },
  { id: '00000000-0000-0000-0000-0000000c010c', code: 'R00.04.01', name: 'Máy phát điện dự phòng', unit: 'CAI', price: 42000000 },
];

// Tập vật chất "spine sâu" (lô/giao dịch/snapshot/định mức/tính NC/kiểm kê) — giữ nhỏ (medium).
export const CORE_MATERIAL_CODES = ['R00.01.01', 'R00.01.03', 'R00.02.01', 'R00.03.01', 'R00.03.02', 'R00.04.01'];

// Mốc thời gian tất định cho chuỗi (tái lập).
export const T_RECEIPT = new Date('2026-03-01T00:00:00Z'); // DT-04 nhập ban đầu
export const T_SNAPSHOT = new Date('2026-06-30T00:00:00Z'); // DT-04 as-of / HC snapshot cho DT-08
export const T_DOC = new Date('2026-07-15T00:00:00Z'); // DT-05 chứng từ (sau snapshot ⇒ HC sống lệch)
export const T_CUTOFF = new Date('2026-09-30T00:00:00Z'); // DT-10 cutoff kiểm kê

// Cây R00 (nhóm cha) để dựng danh mục có cấu trúc.
export const CATALOG_GROUPS: Array<{ id: string; code: string; name: string }> = [
  { id: '00000000-0000-0000-0000-0000000c0011', code: 'R00.01', name: 'Doanh cụ' },
  { id: '00000000-0000-0000-0000-0000000c0012', code: 'R00.02', name: 'Trang bị nhà ăn' },
  { id: '00000000-0000-0000-0000-0000000c0013', code: 'R00.03', name: 'Vật liệu xây dựng' },
  { id: '00000000-0000-0000-0000-0000000c0014', code: 'R00.04', name: 'Thiết bị kỹ thuật doanh trại' },
];

// ĐVT dùng trong bộ mẫu.
export const UNITS: Array<{ code: string; name: string; symbol: string; unitType: string }> = [
  { code: 'CAI', name: 'Cái', symbol: 'cái', unitType: 'COUNT' },
  { code: 'BO', name: 'Bộ', symbol: 'bộ', unitType: 'COUNT' },
  { code: 'KG', name: 'Ki-lô-gam', symbol: 'kg', unitType: 'WEIGHT' },
  { code: 'M2', name: 'Mét vuông', symbol: 'm²', unitType: 'AREA' },
];

// ---- Mã tất định cho các bước chuỗi (tra theo code) ----
export const CHAIN = {
  // DT-04
  materielSnapshotCode: (orgCode: string) => `SNAP-MAT-${orgCode}`,
  lotCode: (orgCode: string, matCode: string) => `LOT-${orgCode}-${matCode}`,
  assetCode: (orgCode: string) => `AST-${orgCode}-0001`,
  movementNo: (orgCode: string, matCode: string, seq: number) =>
    `MV-${orgCode}-${matCode}-${String(seq).padStart(3, '0')}`,
  // DT-05
  documentNo: (orgCode: string, seq: number) => `CT-${orgCode}-${String(seq).padStart(3, '0')}`,
  transferNo: (fromCode: string, toCode: string) => `DC-${fromCode}-${toCode}`,
  // DT-06
  allocationTypeCode: 'ALLOC-SSCD',
  allocationNo: (orgCode: string) => `PB-${orgCode}-001`,
  // DT-07
  normDocNo: 'TT-DM-DT-2026/BQP',
  normSetCode: 'ND-DOANHCU-2026',
  commandNo: 'CL-HC-TH-2026-001',
  // DT-08
  scenarioCode: (orgCode: string) => `KB-${orgCode}-2026`,
  // DT-09
  balancePlanCode: (orgCode: string) => `CD-${orgCode}-2026`,
  territorialSourceCode: (orgCode: string) => `NG-${orgCode}-001`,
  // DT-10
  countCampaignCode: (orgCode: string) => `KK-${orgCode}-2026`,
};

// ---------------------------------------------------------------------------
// Helper tra cứu (org/area theo code) + chọn xã đại diện ổn định.
// ---------------------------------------------------------------------------
export interface RepCommune {
  areaId: string;
  areaCode: string;
  areaName: string;
  orgId: string;
  orgCode: string;
}

export async function findOrgIdByCode(ds: DataSource, code: string): Promise<string | null> {
  const rows = await ds.query('SELECT id FROM organizations WHERE code = $1 LIMIT 1', [code]);
  return rows?.[0]?.id ?? null;
}

export async function getProvinceOrgId(ds: DataSource): Promise<string> {
  const id = await findOrgIdByCode(ds, PROVINCE_ORG_CODE);
  if (!id) throw new Error(`Chưa có đơn vị tỉnh ${PROVINCE_ORG_CODE} — chạy bước 00-foundation trước.`);
  return id;
}

// Chọn tối đa n xã đại diện: ưu tiên PREFERRED_COMMUNE_CODES (nếu có org DV-<code>),
// bù thêm bằng các xã khác của tỉnh (ổn định theo area.code) cho đủ n.
export async function pickRepresentativeCommunes(ds: DataSource, n = 4): Promise<RepCommune[]> {
  const out: RepCommune[] = [];
  const seen = new Set<string>();

  const tryAdd = async (areaCode: string) => {
    if (seen.has(areaCode) || out.length >= n) return;
    const rows = await ds.query(
      `SELECT a.id AS area_id, a.code AS area_code, a.name AS area_name, o.id AS org_id, o.code AS org_code
         FROM administrative_areas a
         JOIN organizations o ON o.code = 'DV-' || a.code
        WHERE a.code = $1 LIMIT 1`,
      [areaCode],
    );
    if (rows?.[0]) {
      out.push({
        areaId: rows[0].area_id,
        areaCode: rows[0].area_code,
        areaName: rows[0].area_name,
        orgId: rows[0].org_id,
        orgCode: rows[0].org_code,
      });
      seen.add(areaCode);
    }
  };

  for (const code of PREFERRED_COMMUNE_CODES) await tryAdd(code);

  if (out.length < n) {
    const rows = await ds.query(
      `SELECT a.id AS area_id, a.code AS area_code, a.name AS area_name, o.id AS org_id, o.code AS org_code
         FROM administrative_areas a
         JOIN organizations o ON o.code = 'DV-' || a.code
        WHERE a.province_code = $1 AND a.level = 'COMMUNE'
        ORDER BY a.code
        LIMIT 60`,
      [PROVINCE_AREA_CODE],
    );
    for (const r of rows) {
      if (out.length >= n) break;
      if (seen.has(r.area_code)) continue;
      out.push({
        areaId: r.area_id,
        areaCode: r.area_code,
        areaName: r.area_name,
        orgId: r.org_id,
        orgCode: r.org_code,
      });
      seen.add(r.area_code);
    }
  }

  if (out.length === 0) {
    throw new Error(
      'Không tìm thấy xã đại diện nào của Thanh Hóa có đơn vị DV-<mã> — chạy 00-foundation (và GIS) trước.',
    );
  }
  return out;
}
