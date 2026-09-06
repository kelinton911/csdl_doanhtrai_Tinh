// Seed golden R00 (DT-01 — Quyển I). Một phiên bản danh mục doanh trại tối giản để demo
// chuỗi nghiệp vụ: ĐVT → phiên bản → cây R00 → alias → công bố. Idempotent theo version_code.
import 'reflect-metadata';
import dataSource from '../data-source';
import { UnitOfMeasure } from '../../modules/catalog/entities/unit-of-measure.entity';
import { CatalogVersion } from '../../modules/catalog/entities/catalog-version.entity';
import { MaterialCatalog } from '../../modules/catalog/entities/material-catalog.entity';
import { MaterialAlias } from '../../modules/catalog/entities/material-alias.entity';
import { CatalogVersionStatus } from '../../common/enums';
import { normalizeAlias } from '../../modules/catalog/catalog-rules';

const VERSION_CODE = 'R00-DT-2026';

// Cây danh mục doanh trại (mã, tên, mã cha, ĐVT).
const TREE: Array<{ code: string; name: string; parent?: string; unit?: string }> = [
  { code: 'R00.01', name: 'Doanh cụ' },
  { code: 'R00.01.01', name: 'Bàn làm việc', parent: 'R00.01', unit: 'CAI' },
  { code: 'R00.01.02', name: 'Ghế tựa', parent: 'R00.01', unit: 'CAI' },
  { code: 'R00.01.03', name: 'Giường cá nhân', parent: 'R00.01', unit: 'CAI' },
  { code: 'R00.01.04', name: 'Tủ đựng quân tư trang', parent: 'R00.01', unit: 'CAI' },
  { code: 'R00.02', name: 'Trang bị nhà ăn' },
  { code: 'R00.02.01', name: 'Bàn ăn', parent: 'R00.02', unit: 'CAI' },
  { code: 'R00.02.02', name: 'Ghế băng', parent: 'R00.02', unit: 'CAI' },
  { code: 'R00.03', name: 'Vật liệu' },
  { code: 'R00.03.01', name: 'Sơn', parent: 'R00.03', unit: 'KG' },
];

const UNITS = [
  { code: 'CAI', name: 'Cái', symbol: 'cái', unitType: 'COUNT' },
  { code: 'BO', name: 'Bộ', symbol: 'bộ', unitType: 'COUNT' },
  { code: 'KG', name: 'Ki-lô-gam', symbol: 'kg', unitType: 'WEIGHT' },
  { code: 'M2', name: 'Mét vuông', symbol: 'm²', unitType: 'AREA' },
];

const ALIASES = [
  { code: 'R00.01.02', alias: 'Ghế TL' },
  { code: 'R00.01.01', alias: 'Bàn văn phòng' },
];

async function run() {
  await dataSource.initialize();
  const unitRepo = dataSource.getRepository(UnitOfMeasure);
  const versionRepo = dataSource.getRepository(CatalogVersion);
  const itemRepo = dataSource.getRepository(MaterialCatalog);
  const aliasRepo = dataSource.getRepository(MaterialAlias);

  // ĐVT.
  const unitIdByCode = new Map<string, string>();
  for (const u of UNITS) {
    let unit = await unitRepo.findOne({ where: { code: u.code } });
    if (!unit) unit = await unitRepo.save(unitRepo.create(u as Partial<UnitOfMeasure>));
    unitIdByCode.set(u.code, unit.id);
  }

  // Phiên bản (idempotent).
  let version = await versionRepo.findOne({ where: { versionCode: VERSION_CODE } });
  if (!version) {
    version = await versionRepo.save(
      versionRepo.create({
        versionCode: VERSION_CODE,
        versionName: 'Danh mục R00 doanh trại 2026 (mẫu)',
        status: CatalogVersionStatus.DRAFT,
        effectiveFrom: '2026-01-01',
      }),
    );
  }

  // Cây R00.
  const idByCode = new Map<string, string>();
  for (const node of TREE) {
    let item = await itemRepo.findOne({ where: { versionId: version.id, code: node.code } });
    const parentId = node.parent ? idByCode.get(node.parent) ?? null : null;
    const levelNo = node.code.split('.').length - 1;
    if (!item) {
      item = await itemRepo.save(
        itemRepo.create({
          versionId: version.id,
          code: node.code,
          name: node.name,
          parentId,
          levelNo,
          unitId: node.unit ? unitIdByCode.get(node.unit) ?? null : null,
          isLeaf: !TREE.some((t) => t.parent === node.code),
        }),
      );
    }
    idByCode.set(node.code, item.id);
  }

  // Alias.
  for (const a of ALIASES) {
    const materialId = idByCode.get(a.code);
    if (!materialId) continue;
    const normalized = normalizeAlias(a.alias);
    const exists = await aliasRepo.findOne({ where: { aliasNormalized: normalized } });
    if (!exists) {
      await aliasRepo.save(
        aliasRepo.create({ materialCatalogId: materialId, aliasName: a.alias, aliasNormalized: normalized }),
      );
    }
  }

  // Công bố phiên bản nếu đang DRAFT (để có bản PUBLISHED làm nền cho DT-02…).
  if (version.status === CatalogVersionStatus.DRAFT) {
    version.status = CatalogVersionStatus.PUBLISHED;
    version.publishedAt = new Date();
    await versionRepo.save(version);
  }

  console.log(
    `DT-01 seed: version ${VERSION_CODE} (${version.status}), ${TREE.length} mã, ${UNITS.length} ĐVT, ${ALIASES.length} alias.`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
