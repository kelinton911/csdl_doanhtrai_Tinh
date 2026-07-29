// Nạp ĐỊA GIỚI HÀNH CHÍNH THẬT (GIS) cho MỘT tỉnh từ file GeoJSON (EPSG:4326).
// - Khai báo Tỉnh: qua env PROVINCE_CODE/PROVINCE_NAME, hoặc REAL_PROVINCE trong real-areas.data.ts.
// - Mỗi feature = 1 địa bàn cấp xã; properties: { code, name, type } (type: COMMUNE|WARD|SPECIAL_ZONE).
// - geometry (Polygon/MultiPolygon) nạp vào cột administrative_areas.geometry (MultiPolygon, SRID 4326)
//   qua PostGIS ST_GeomFromGeoJSON — KHÔNG cần thư viện GIS bên ngoài.
// Idempotent: upsert theo `code`; chạy lại an toàn. KHÔNG động dữ liệu nghiệp vụ.
//
// Chạy:  npm run seed:geojson -- <đường-dẫn.geojson>
//   hoặc: PROVINCE_CODE=TINH-XX PROVINCE_NAME='Tỉnh ...' AREAS_GEOJSON=path npm run seed:geojson
import 'reflect-metadata';
import * as fs from 'fs';
import { join } from 'path';
import dataSource from '../data-source';
import { Organization } from '../../modules/identity/entities/organization.entity';
import { AdministrativeArea } from '../../modules/organization/entities/administrative-area.entity';
import { REAL_PROVINCE, createUnitPerArea } from './real-areas.data';

const VALID_TYPES = ['COMMUNE', 'WARD', 'SPECIAL_ZONE'];

async function run() {
  const provinceCode = (process.env.PROVINCE_CODE || REAL_PROVINCE.code).trim();
  const provinceName = (process.env.PROVINCE_NAME || REAL_PROVINCE.name).trim();
  const geojsonPath =
    process.env.AREAS_GEOJSON || process.argv[2] || join(__dirname, 'data', 'areas.geojson');

  if (!provinceCode || !provinceName) {
    throw new Error(
      'Chưa khai báo Tỉnh. Đặt env PROVINCE_CODE + PROVINCE_NAME, hoặc điền REAL_PROVINCE trong real-areas.data.ts.',
    );
  }
  if (!fs.existsSync(geojsonPath)) {
    throw new Error(
      `Không thấy file GeoJSON: ${geojsonPath}. Truyền đường dẫn: npm run seed:geojson -- <path>, hoặc đặt AREAS_GEOJSON.`,
    );
  }

  const raw = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
  const features: any[] | null =
    raw?.type === 'FeatureCollection' ? raw.features : Array.isArray(raw?.features) ? raw.features : null;
  if (!features || features.length === 0) {
    throw new Error('GeoJSON không hợp lệ hoặc rỗng: cần FeatureCollection có mảng features.');
  }

  await dataSource.initialize();
  const orgRepo = dataSource.getRepository(Organization);
  const areaRepo = dataSource.getRepository(AdministrativeArea);

  // 1) Khai báo Tỉnh (PROVINCE) — idempotent theo code.
  let province = await orgRepo.findOne({ where: { code: provinceCode } });
  if (!province) {
    province = await orgRepo.save(
      orgRepo.create({ code: provinceCode, name: provinceName, type: 'PROVINCE', status: 'ACTIVE' }),
    );
    console.log('  + Tỉnh:', provinceCode, '-', provinceName);
  } else {
    console.log('  = Tỉnh đã có:', provinceCode);
  }

  // 2) Nạp từng địa bàn + geometry.
  let upserted = 0;
  let withGeom = 0;
  let addedUnits = 0;
  const errors: string[] = [];
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const p = f?.properties ?? {};
    const code = String(p.code ?? '').trim();
    const name = String(p.name ?? '').trim();
    const type = String(p.type ?? 'COMMUNE').trim().toUpperCase();
    if (!code || !name) {
      errors.push(`Feature #${i}: thiếu properties.code/name`);
      continue;
    }
    if (!VALID_TYPES.includes(type)) {
      errors.push(`Feature #${i} (${code}): type không hợp lệ '${type}' (COMMUNE|WARD|SPECIAL_ZONE)`);
      continue;
    }

    let area = await areaRepo.findOne({ where: { code } });
    if (!area) area = areaRepo.create({ code, name, type, status: 'ACTIVE' });
    else {
      area.name = name;
      area.type = type;
    }
    await areaRepo.save(area);
    upserted++;

    if (f.geometry) {
      // ST_Multi để chấp nhận cả Polygon lẫn MultiPolygon (cột là MultiPolygon).
      await dataSource.query(
        `UPDATE administrative_areas
         SET geometry = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)), updated_at = now()
         WHERE code = $2`,
        [JSON.stringify(f.geometry), code],
      );
      withGeom++;
    }

    if (createUnitPerArea) {
      const orgCode = `DV-${code}`;
      if (!(await orgRepo.findOne({ where: { code: orgCode } }))) {
        await orgRepo.save(
          orgRepo.create({ code: orgCode, name: `Ban CHQS ${name}`, type: 'COMMUNE', parentId: province.id, status: 'ACTIVE' }),
        );
        addedUnits++;
      }
    }
  }

  console.log(`  + Địa bàn upsert: ${upserted}/${features.length} · có geometry: ${withGeom} · đơn vị mới: ${addedUnits}`);
  if (errors.length) {
    console.warn(`  ! ${errors.length} feature bị bỏ qua do lỗi:`);
    errors.slice(0, 20).forEach((e) => console.warn('    - ' + e));
  }

  await dataSource.destroy();
  console.log('\n  Nạp GIS địa giới hoàn tất. RÀ SOÁT: Quản trị → Đơn vị & địa bàn, và Bản đồ.');
}

run().catch((err) => {
  console.error('Seed GeoJSON lỗi:', err);
  process.exit(1);
});
