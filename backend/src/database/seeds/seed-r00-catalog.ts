// Nạp danh mục vật chất doanh trại (R00) từ bảng vận hành `materials` + cây nhóm `catalogs`
// (type='material-category') VÀO `material_catalog` → hợp nhất tuyệt đối: khai báo/DT-04/DT-05 chọn
// được R00 thật (không chỉ mẫu). Cùng picker cây với Quân nhu. Cầu nối catalog→materials khớp theo mã.
// Idempotent: UPSERT theo (version_id, code). Mã R00 khác Quân nhu (Y2.1.*) nên không đụng nhau.
import 'reflect-metadata';
import dataSource from '../data-source';
import { CatalogVersion } from '../../modules/catalog/entities/catalog-version.entity';
import { MaterialCatalog } from '../../modules/catalog/entities/material-catalog.entity';
import { UnitOfMeasure } from '../../modules/catalog/entities/unit-of-measure.entity';
import { CatalogVersionStatus } from '../../common/enums';
import { normalizeText } from '../../common/tabular';

const VERSION_CODE = 'R00-DT-FULL-2026';
const VERSION_NAME = 'Vật chất doanh trại (danh mục vận hành)';
const DEMO_R00_VERSIONS = ['R00-DT-2026', 'R00-DT-TH-2026']; // bản mẫu → cho SUPERSEDED để picker gọn

// ĐVT bổ sung (giữ ký hiệu nguồn). CAI/BO/KG/HT/TB/M2 thường đã có.
const UNIT_NAMES: Record<string, { name: string; unitType: string }> = {
  CAI: { name: 'Cái', unitType: 'COUNT' },
  BO: { name: 'Bộ', unitType: 'COUNT' },
  KG: { name: 'Ki-lô-gam', unitType: 'WEIGHT' },
  HT: { name: 'HT', unitType: 'OTHER' },
  TB: { name: 'TB', unitType: 'OTHER' },
  M: { name: 'Mét', unitType: 'LENGTH' },
  M2: { name: 'Mét vuông', unitType: 'AREA' },
  M3: { name: 'Mét khối', unitType: 'VOLUME' },
  LIT: { name: 'Lít', unitType: 'VOLUME' },
  SOI: { name: 'Sợi', unitType: 'COUNT' },
  TRAM: { name: 'Trạm', unitType: 'OTHER' },
};

// Cấp trong cây = số nhóm khác '00' ở 4 vị trí giữa (R00.aa.bb.cc.dd.eee).
function catLevel(code: string): number {
  return code.split('.').slice(1, 5).filter((g) => g !== '00').length;
}
// Mã nhóm cha = xoá nhóm khác '00' ở vị trí sâu nhất (1..4). Root (Doanh trại) → null.
function parentCatCode(code: string): string | null {
  const p = code.split('.');
  for (let i = 4; i >= 1; i--) {
    if (p[i] !== '00') { const q = [...p]; q[i] = '00'; return q.join('.'); }
  }
  return null;
}
// Mã nhóm chứa 1 vật chất (đưa nhóm cuối về '000').
function itemCatCode(code: string): string {
  const p = code.split('.');
  if (p.length >= 6) p[5] = '000';
  return p.join('.');
}

async function run() {
  await dataSource.initialize();
  const versionRepo = dataSource.getRepository(CatalogVersion);
  const itemRepo = dataSource.getRepository(MaterialCatalog);
  const unitRepo = dataSource.getRepository(UnitOfMeasure);

  // 1) Đọc nguồn: nhóm R00 (có tên) + vật chất R00.
  const cats: Array<{ code: string; name: string }> = await dataSource.query(
    `SELECT code, name FROM catalogs WHERE type='material-category' AND code LIKE 'R00.%'`,
  );
  const mats: Array<{ code: string; name: string; unit_code: string | null; category_code: string | null }> =
    await dataSource.query(
      `SELECT code, name, unit_code, category_code FROM materials WHERE code LIKE 'R00.%' ORDER BY code`,
    );
  if (mats.length === 0) {
    console.error('Bảng materials chưa có mã R00 — chạy seed danh mục R00 trước (seed:official-catalog/thanh-hoa).');
    await dataSource.destroy();
    process.exit(1);
  }

  // 2) ĐVT — bảo đảm mọi unit_code của R00 tồn tại.
  const unitIdByCode = new Map<string, string>();
  const usedUnits = new Set<string>();
  for (const m of mats) if (m.unit_code) usedUnits.add(m.unit_code);
  for (const code of usedUnits) {
    let u = await unitRepo.findOne({ where: { code } });
    if (!u) {
      const def = UNIT_NAMES[code] ?? { name: code, unitType: 'OTHER' };
      u = await unitRepo.save(unitRepo.create({ code, name: def.name, unitType: def.unitType } as Partial<UnitOfMeasure>));
    }
    unitIdByCode.set(code, u.id);
  }

  // 3) Phiên bản.
  let version = await versionRepo.findOne({ where: { versionCode: VERSION_CODE } });
  if (!version) {
    version = await versionRepo.save(
      versionRepo.create({
        versionCode: VERSION_CODE,
        versionName: VERSION_NAME,
        status: CatalogVersionStatus.DRAFT,
        effectiveFrom: '2026-01-01',
      }),
    );
  }

  // 4) Nhóm (categories) — bảo đảm có gốc "Doanh trại" và mọi nhóm cha; nạp theo cấp tăng dần.
  const catByCode = new Map<string, { code: string; name: string }>();
  for (const c of cats) catByCode.set(c.code, c);
  // Bổ sung nhóm cha còn thiếu bằng cách suy từ mã (tên = mã nếu không có trong catalogs).
  for (const c of [...catByCode.values()]) {
    let p = parentCatCode(c.code);
    while (p && !catByCode.has(p)) { catByCode.set(p, { code: p, name: p }); p = parentCatCode(p); }
  }
  const allCats = [...catByCode.values()].sort((a, b) => catLevel(a.code) - catLevel(b.code) || a.code.localeCompare(b.code));

  const idByCode = new Map<string, string>();
  const preload = await itemRepo.find({ where: { versionId: version.id }, select: { id: true, code: true } });
  for (const e of preload) idByCode.set(e.code, e.id);

  const upsertNode = async (node: Partial<MaterialCatalog> & { code: string }) => {
    const existingId = idByCode.get(node.code);
    const saved = await itemRepo.save(itemRepo.create({ ...node, id: existingId, versionId: version!.id }));
    idByCode.set(node.code, saved.id);
    return saved.id;
  };

  for (const c of allCats) {
    const pc = parentCatCode(c.code);
    await upsertNode({
      code: c.code,
      name: c.name,
      parentId: pc ? idByCode.get(pc) ?? null : null,
      levelNo: catLevel(c.code),
      isLeaf: false,
      searchKey: normalizeText(c.name),
    });
  }

  // 5) Vật chất (leaves) — gắn vào nhóm theo category_code (đi lên nếu nhóm trực tiếp không có).
  const resolveCat = (code: string | null): string | null => {
    let c = code || null;
    while (c) { if (idByCode.has(c)) return idByCode.get(c)!; c = parentCatCode(c); }
    return null;
  };
  let itemCount = 0;
  for (const m of mats) {
    const catCode = m.category_code && catByCode.has(m.category_code) ? m.category_code : itemCatCode(m.code);
    const parentId = resolveCat(catCode);
    await upsertNode({
      code: m.code,
      name: m.name,
      parentId,
      levelNo: (parentId ? catLevel(catCode) : 0) + 1,
      unitId: m.unit_code ? unitIdByCode.get(m.unit_code) ?? null : null,
      isLeaf: true,
      searchKey: normalizeText(m.name),
    });
    itemCount++;
  }

  // 6) Công bố + cho các bản R00 mẫu sang SUPERSEDED để picker chỉ còn R00 (vận hành) + Quân nhu.
  if (version.status !== CatalogVersionStatus.PUBLISHED) {
    version.status = CatalogVersionStatus.PUBLISHED;
    version.publishedAt = new Date();
    await versionRepo.save(version);
  }
  let superseded = 0;
  for (const vc of DEMO_R00_VERSIONS) {
    const v = await versionRepo.findOne({ where: { versionCode: vc } });
    if (v && v.status === CatalogVersionStatus.PUBLISHED) {
      v.status = CatalogVersionStatus.SUPERSEDED;
      await versionRepo.save(v);
      superseded++;
    }
  }

  const dbTotal = await itemRepo.count({ where: { versionId: version.id } });
  console.log(
    `R00 catalog seed: version ${VERSION_CODE} (${version.status}); nhóm=${allCats.length}, vật chất=${itemCount}, ` +
      `tổng node DB=${dbTotal}; ĐVT dùng=${usedUnits.size}; bản mẫu SUPERSEDED=${superseded}.`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
