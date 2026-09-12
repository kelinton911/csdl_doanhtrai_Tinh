// Seed danh mục mã định danh Ngành Quân nhu (Phụ lục I) — 2793 mã (1 ROOT + 30 CATEGORY + 2762 ITEM).
// Nạp vào material_catalog dưới một phiên bản PUBLISHED riêng (QN-PL1-2026) để dùng ngay cho khai báo
// vật chất. `code` là khóa nghiệp vụ duy nhất; UPSERT theo (version_id, code) → idempotent.
// Giữ nguyên name_source & unit_source; KHÔNG tự suy diễn ĐVT cho 11 ITEM thiếu (unit_id = NULL).
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import dataSource from '../data-source';
import { UnitOfMeasure } from '../../modules/catalog/entities/unit-of-measure.entity';
import { CatalogVersion } from '../../modules/catalog/entities/catalog-version.entity';
import { MaterialCatalog } from '../../modules/catalog/entities/material-catalog.entity';
import { CatalogVersionStatus } from '../../common/enums';

const VERSION_CODE = 'QN-PL1-2026';
const VERSION_NAME = 'Quân nhu (Phụ lục I) 2026';
const SOURCE_FILE = path.join(__dirname, 'data', 'quan-nhu-master.json');

// ĐVT nguồn (giữ nguyên ký hiệu; không mở rộng). CAI/BO/KG có thể đã tồn tại → UPSERT theo code.
const UNIT_DEFS: Array<{ code: string; name: string; symbol: string; unitType: string }> = [
  { code: 'CAI', name: 'Cái', symbol: 'cái', unitType: 'COUNT' },
  { code: 'BO', name: 'Bộ', symbol: 'bộ', unitType: 'COUNT' },
  { code: 'DOI', name: 'Đôi', symbol: 'đôi', unitType: 'COUNT' },
  { code: 'MET', name: 'Mét', symbol: 'm', unitType: 'LENGTH' },
  { code: 'HT', name: 'HT', symbol: 'HT', unitType: 'OTHER' },
  { code: 'KG', name: 'Ki-lô-gam', symbol: 'kg', unitType: 'WEIGHT' },
  { code: 'TB', name: 'TB', symbol: 'TB', unitType: 'OTHER' },
];

interface MasterRow {
  code: string;
  name_source: string;
  search_key: string | null;
  unit_code: string | null;
  record_type: 'ROOT' | 'CATEGORY' | 'ITEM';
  node_level: number;
  parent_code: string | null;
  source_row: number | null;
}

async function run() {
  await dataSource.initialize();
  const unitRepo = dataSource.getRepository(UnitOfMeasure);
  const versionRepo = dataSource.getRepository(CatalogVersion);
  const itemRepo = dataSource.getRepository(MaterialCatalog);

  // 1) ĐVT — UPSERT theo code.
  const unitIdByCode = new Map<string, string>();
  for (const u of UNIT_DEFS) {
    let unit = await unitRepo.findOne({ where: { code: u.code } });
    if (!unit) unit = await unitRepo.save(unitRepo.create(u as Partial<UnitOfMeasure>));
    unitIdByCode.set(u.code, unit.id);
  }

  // 2) Phiên bản danh mục — UPSERT theo version_code.
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

  // 3) Đọc dữ liệu nguồn.
  const rows: MasterRow[] = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  const parentCodes = new Set<string>();
  for (const r of rows) if (r.parent_code) parentCodes.add(r.parent_code);

  // Nạp theo node_level tăng dần để cha luôn có id trước con (parent_id ánh xạ chuẩn).
  const byLevel = new Map<number, MasterRow[]>();
  for (const r of rows) {
    const arr = byLevel.get(r.node_level) ?? [];
    arr.push(r);
    byLevel.set(r.node_level, arr);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  // Nạp trước các item hiện có của phiên bản để quyết định INSERT/UPDATE (idempotent, nhanh).
  const existing = await itemRepo.find({ where: { versionId: version.id }, select: { id: true, code: true } });
  const idByCode = new Map<string, string>();
  for (const e of existing) idByCode.set(e.code, e.id);

  let processed = 0;
  for (const lvl of levels) {
    const batch: MaterialCatalog[] = [];
    for (const r of byLevel.get(lvl)!) {
      const entity = itemRepo.create({
        id: idByCode.get(r.code), // có id → UPDATE; undefined → INSERT
        versionId: version.id,
        code: r.code,
        name: r.name_source,
        parentId: r.parent_code ? idByCode.get(r.parent_code) ?? null : null,
        levelNo: r.node_level,
        unitId: r.unit_code ? unitIdByCode.get(r.unit_code) ?? null : null,
        isLeaf: !parentCodes.has(r.code),
        searchKey: r.search_key ?? null,
        sourceRowNo: r.source_row ?? null,
      });
      batch.push(entity);
    }
    // Lưu theo lô; save trả về entity kèm id để cấp dưới ánh xạ parent_id.
    for (let i = 0; i < batch.length; i += 500) {
      const saved = await itemRepo.save(batch.slice(i, i + 500));
      for (const s of saved) idByCode.set(s.code, s.id);
      processed += saved.length;
    }
  }

  // 4) Công bố (PUBLISHED) — KHÔNG supersede phiên bản khác (search không lọc theo version status).
  if (version.status !== CatalogVersionStatus.PUBLISHED) {
    version.status = CatalogVersionStatus.PUBLISHED;
    version.publishedAt = new Date();
    await versionRepo.save(version);
  }

  // 5) Tự kiểm tra.
  const srcTotal = rows.length;
  const srcRootCat = rows.filter((r) => r.record_type !== 'ITEM').length;
  const srcItems = rows.filter((r) => r.record_type === 'ITEM').length;
  const dbTotal = await itemRepo.count({ where: { versionId: version.id } });
  const dbLeaf = await itemRepo.count({ where: { versionId: version.id, isLeaf: true } });
  const dbNonLeaf = dbTotal - dbLeaf;

  console.log(
    `QN seed: version ${VERSION_CODE} (${version.status}); nguồn total=${srcTotal}, ` +
      `root+category=${srcRootCat}, item=${srcItems}; DB total=${dbTotal}, non-leaf=${dbNonLeaf}, leaf=${dbLeaf}.`,
  );

  const ok = srcTotal === 2793 && srcRootCat === 31 && srcItems === 2762 && dbTotal === srcTotal && processed === srcTotal;
  if (!ok) {
    console.error(
      `QN seed KHÔNG khớp kỳ vọng (2793/31/2762). processed=${processed}, dbTotal=${dbTotal}.`,
    );
    await dataSource.destroy();
    process.exit(1);
  }

  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
