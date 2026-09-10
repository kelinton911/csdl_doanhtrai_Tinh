// [01] DT-01 — Danh mục chuẩn R00 doanh trại (Quyển I). Một phiên bản PUBLISHED + ĐVT +
// cây R00 (nhóm + lá) với ID CỐ ĐỊNH (demo-ids) để DT-03..DT-12 tham chiếu ổn định. + alias.
// Idempotent theo version_code / id.
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CatalogVersion } from '../../../modules/catalog/entities/catalog-version.entity';
import { MaterialCatalog } from '../../../modules/catalog/entities/material-catalog.entity';
import { UnitOfMeasure } from '../../../modules/catalog/entities/unit-of-measure.entity';
import { MaterialAlias } from '../../../modules/catalog/entities/material-alias.entity';
import { CatalogVersionStatus } from '../../../common/enums';
import { normalizeAlias } from '../../../modules/catalog/catalog-rules';
import { standalone } from './_shared/run-step';
import {
  CATALOG_VERSION_ID,
  CATALOG_VERSION_CODE,
  CATALOG_GROUPS,
  MATERIALS,
  UNITS,
} from './_shared/demo-ids';

const ALIASES: Array<{ code: string; alias: string }> = [
  { code: 'R00.01.02', alias: 'Ghế TL' },
  { code: 'R00.01.01', alias: 'Bàn văn phòng' },
  { code: 'R00.04.01', alias: 'Máy nổ' },
];

export async function run(ds: DataSource): Promise<void> {
  const versionRepo = ds.getRepository(CatalogVersion);
  const itemRepo = ds.getRepository(MaterialCatalog);
  const unitRepo = ds.getRepository(UnitOfMeasure);
  const aliasRepo = ds.getRepository(MaterialAlias);

  // 1) ĐVT.
  const unitIdByCode = new Map<string, string>();
  for (const u of UNITS) {
    let unit = await unitRepo.findOne({ where: { code: u.code } });
    if (!unit) unit = await unitRepo.save(unitRepo.create(u as Partial<UnitOfMeasure>));
    unitIdByCode.set(u.code, unit.id);
  }

  // 2) Phiên bản danh mục (id cố định).
  let version = await versionRepo.findOne({ where: { id: CATALOG_VERSION_ID } });
  if (!version) {
    version = await versionRepo.save(
      versionRepo.create({
        id: CATALOG_VERSION_ID,
        versionCode: CATALOG_VERSION_CODE,
        versionName: 'Danh mục R00 doanh trại Thanh Hóa 2026 (mẫu)',
        status: CatalogVersionStatus.DRAFT,
        effectiveFrom: '2026-01-01',
      }),
    );
  }

  // 3) Nhóm cha (id cố định) rồi lá (id cố định).
  const idByCode = new Map<string, string>();
  for (const g of CATALOG_GROUPS) {
    if (!(await itemRepo.findOne({ where: { id: g.id } }))) {
      await itemRepo.save(
        itemRepo.create({
          id: g.id,
          versionId: version.id,
          code: g.code,
          name: g.name,
          parentId: null,
          levelNo: g.code.split('.').length - 1,
          isLeaf: false,
        }),
      );
    }
    idByCode.set(g.code, g.id);
  }
  for (const m of MATERIALS) {
    if (!(await itemRepo.findOne({ where: { id: m.id } }))) {
      const parentCode = m.code.split('.').slice(0, -1).join('.');
      await itemRepo.save(
        itemRepo.create({
          id: m.id,
          versionId: version.id,
          code: m.code,
          name: m.name,
          parentId: idByCode.get(parentCode) ?? null,
          levelNo: m.code.split('.').length - 1,
          unitId: unitIdByCode.get(m.unit) ?? null,
          isLeaf: true,
          effectiveFrom: '2026-01-01',
        }),
      );
    }
    idByCode.set(m.code, m.id);
  }

  // 4) Alias.
  for (const a of ALIASES) {
    const materialId = idByCode.get(a.code);
    if (!materialId) continue;
    const normalized = normalizeAlias(a.alias);
    if (!(await aliasRepo.findOne({ where: { aliasNormalized: normalized } }))) {
      await aliasRepo.save(
        aliasRepo.create({ materialCatalogId: materialId, aliasName: a.alias, aliasNormalized: normalized }),
      );
    }
  }

  // 5) Công bố (PUBLISHED) để làm nền cho DT-02…
  if (version.status !== CatalogVersionStatus.PUBLISHED) {
    version.status = CatalogVersionStatus.PUBLISHED;
    version.publishedAt = new Date();
    await versionRepo.save(version);
  }

  console.log(
    `  [01] DT-01: version ${CATALOG_VERSION_CODE} (${version.status}), ` +
      `${CATALOG_GROUPS.length} nhóm + ${MATERIALS.length} vật chất + ${ALIASES.length} alias.`,
  );
}

if (require.main === module) standalone(run);
