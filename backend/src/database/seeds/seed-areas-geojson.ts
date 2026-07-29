// Nạp ĐỊA GIỚI HÀNH CHÍNH THẬT (GIS) từ GeoJSON (EPSG:4326) vào bảng administrative_areas.
// Hỗ trợ TOÀN QUỐC: cả cấp Tỉnh (level=PROVINCE) lẫn cấp Xã/Phường/Đặc khu (level=COMMUNE), nhiều file.
// TỰ NHẬN DIỆN bộ dữ liệu "vietnam_gis_admin_2026" (province_code/commune_code/unit_type...) và cả
// định dạng rút gọn (code/name/type). KHÔNG bịa dữ liệu — chỉ nạp đúng những gì có trong file.
//
// geometry: Polygon|MultiPolygon → cột geometry (MultiPolygon,4326); feature geometry=null vẫn nạp thuộc tính.
// centroid tự tính bằng ST_PointOnSurface khi có geometry (điểm chắc chắn nằm trong ranh giới) để đặt nhãn.
// Idempotent: upsert theo `code`; chạy lại an toàn. KHÔNG động dữ liệu nghiệp vụ.
//
// Chạy (bộ dữ liệu người dùng cung cấp trong docs/):
//   npm run seed:geojson -- \
//     ../docs/vietnam_gis_admin_2026_geojson/vietnam_provinces_2026.geojson \
//     ../docs/vietnam_gis_admin_2026_geojson/vietnam_communes_2026_attributes.geojson
//   (xã sẽ có tên/loại/tỉnh nhưng chưa có ranh giới — chạy scripts/build_full_commune_boundaries.py
//    để tạo vietnam_communes_2026_polygons.geojson rồi nạp file đó để có ranh giới xã.)
import 'reflect-metadata';
import * as fs from 'fs';
import { basename, isAbsolute, join } from 'path';
import dataSource from '../data-source';
import { AdministrativeArea } from '../../modules/organization/entities/administrative-area.entity';

const PROVINCE_TYPES = ['TINH', 'THANH_PHO'];
const COMMUNE_TYPES = ['COMMUNE', 'WARD', 'SPECIAL_ZONE'];

// Chuẩn hoá loại đơn vị (nhận cả tiếng Việt có dấu lẫn mã enum).
const TYPE_MAP: Record<string, string> = {
  'TỈNH': 'TINH', TINH: 'TINH', PROVINCE: 'TINH',
  'THÀNH PHỐ': 'THANH_PHO', 'THANH PHO': 'THANH_PHO', THANH_PHO: 'THANH_PHO', MUNICIPALITY: 'THANH_PHO', CITY: 'THANH_PHO',
  'PHƯỜNG': 'WARD', PHUONG: 'WARD', WARD: 'WARD',
  'XÃ': 'COMMUNE', XA: 'COMMUNE', COMMUNE: 'COMMUNE',
  'ĐẶC KHU': 'SPECIAL_ZONE', 'DAC KHU': 'SPECIAL_ZONE', SPECIAL_ZONE: 'SPECIAL_ZONE', 'SPECIAL ZONE': 'SPECIAL_ZONE',
};
function normType(raw: string): string {
  const k = String(raw ?? '').trim().toUpperCase();
  return TYPE_MAP[k] ?? k;
}

interface AreaRow {
  code: string;
  name: string;
  type: string;
  level: 'PROVINCE' | 'COMMUNE';
  provinceCode: string | null;
  parentCode: string | null;
}

// Rút thuộc tính từ mọi biến thể schema đã biết.
function readProps(p: any): AreaRow | null {
  const communeCode = String(p.commune_code ?? '').trim();
  const provinceCode0 = String(p.province_code ?? '').trim();
  const isCommune = !!communeCode || String(p.admin_level ?? '') === '2';

  const code = String(p.code ?? (communeCode || provinceCode0)).trim();
  const name = String(
    p.name ?? p.commune_full_name ?? p.province_full_name ?? p.commune_name ?? p.province_name ?? '',
  ).trim();
  const type = normType(p.type ?? p.unit_type ?? '') || (isCommune ? 'COMMUNE' : 'TINH');

  const explicitLevel = String(p.level ?? '').trim().toUpperCase();
  const level: 'PROVINCE' | 'COMMUNE' =
    explicitLevel === 'PROVINCE' || explicitLevel === 'COMMUNE'
      ? (explicitLevel as 'PROVINCE' | 'COMMUNE')
      : isCommune
        ? 'COMMUNE'
        : PROVINCE_TYPES.includes(type)
          ? 'PROVINCE'
          : provinceCode0 && !communeCode
            ? 'PROVINCE'
            : 'COMMUNE';

  const provinceCode = level === 'PROVINCE' ? code || provinceCode0 || null : provinceCode0 || null;
  const parentCode =
    level === 'PROVINCE' ? null : provinceCode0 || String(p.parent_code ?? '').trim() || null;

  if (!code || !name) return null;
  return { code, name, type, level, provinceCode, parentCode };
}

function resolveFiles(): string[] {
  const dataDir = join(__dirname, 'data');
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const fromEnv = (process.env.AREAS_GEOJSON || '').split(',').map((s) => s.trim()).filter(Boolean);
  let list = argv.length ? argv : fromEnv;
  if (!list.length) {
    const defaults = ['provinces.geojson', 'wards.geojson']
      .map((f) => join(dataDir, f))
      .filter((f) => fs.existsSync(f));
    list = defaults.length ? defaults : [join(dataDir, 'areas.geojson')];
  }
  return list.map((f) => (isAbsolute(f) ? f : join(process.cwd(), f)));
}

async function loadFile(path: string, areaRepo: any) {
  const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
  const features: any[] | null =
    raw?.type === 'FeatureCollection' ? raw.features : Array.isArray(raw?.features) ? raw.features : null;
  const source = basename(path);
  const errors: string[] = [];
  if (!features || features.length === 0) {
    throw new Error(`GeoJSON không hợp lệ hoặc rỗng (${source}): cần FeatureCollection có mảng features.`);
  }

  let upserted = 0;
  let withGeom = 0;
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const row = readProps(f?.properties ?? {});
    if (!row) {
      errors.push(`${source} #${i}: thiếu code/name`);
      continue;
    }
    if (![...PROVINCE_TYPES, ...COMMUNE_TYPES].includes(row.type)) {
      errors.push(`${source} #${i} (${row.code}): type không hợp lệ '${row.type}'`);
      continue;
    }

    let area = await areaRepo.findOne({ where: { code: row.code } });
    if (!area) area = areaRepo.create({ code: row.code });
    area.name = row.name;
    area.type = row.type;
    area.level = row.level;
    area.parentCode = row.parentCode;
    area.provinceCode = row.provinceCode;
    area.source = source;
    area.status = 'ACTIVE';
    await areaRepo.save(area);
    upserted++;

    if (f.geometry) {
      await areaRepo.query(
        `UPDATE administrative_areas
         SET geometry = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
             centroid = ST_PointOnSurface(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)),
             updated_at = now()
         WHERE code = $2`,
        [JSON.stringify(f.geometry), row.code],
      );
      withGeom++;
    }
  }
  return { upserted, withGeom, errors };
}

async function run() {
  const files = resolveFiles();
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) {
    throw new Error(
      `Không thấy file GeoJSON: ${missing.join(', ')}. ` +
        `Truyền đường dẫn: npm run seed:geojson -- <path...>, hoặc đặt AREAS_GEOJSON. ` +
        `Xem backend/src/database/seeds/data/README.md.`,
    );
  }

  await dataSource.initialize();
  const areaRepo = dataSource.getRepository(AdministrativeArea);

  let totUpsert = 0;
  let totGeom = 0;
  const allErrors: string[] = [];
  for (const f of files) {
    console.log(`  → Nạp ${basename(f)} ...`);
    const r = await loadFile(f, areaRepo);
    totUpsert += r.upserted;
    totGeom += r.withGeom;
    allErrors.push(...r.errors);
    console.log(`     upsert: ${r.upserted} · có geometry: ${r.withGeom}`);
  }

  const provinces = await areaRepo.count({ where: { level: 'PROVINCE' } });
  const communes = await areaRepo.count({ where: { level: 'COMMUNE' } });
  console.log(
    `\n  Tổng: upsert ${totUpsert} · geometry ${totGeom}. Trong DB: ${provinces} tỉnh · ${communes} xã/phường/đặc khu.`,
  );
  if (allErrors.length) {
    console.warn(`  ! ${allErrors.length} feature bị bỏ qua do lỗi:`);
    allErrors.slice(0, 20).forEach((e) => console.warn('    - ' + e));
  }

  await dataSource.destroy();
  console.log('\n  Nạp GIS địa giới hoàn tất. RÀ SOÁT: Quản trị → Đơn vị & địa bàn, và Bản đồ.');
}

run().catch((err) => {
  console.error('Seed GeoJSON lỗi:', err);
  process.exit(1);
});
