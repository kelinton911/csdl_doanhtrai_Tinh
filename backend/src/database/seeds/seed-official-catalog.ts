// Thay danh mục DEMO tự bịa bằng danh mục CHÍNH THỨC dựng từ asset_catalog_items.
//
// Chạy SAU `npm run seed:asset-catalog`.
//
// Hình chiếu (tái sinh được — xoá và dựng lại, KHÔNG sửa tay):
//   materials                      ← 788 nút lá miền MATERIAL (mã = mã R chính thức)
//   catalogs 'material-category'   ←  96 nút nhóm miền MATERIAL (có parent_code)
//   catalogs 'facility-type'       ← 385 nút miền FACILITY (có parent_code)
//
// AN TOÀN: chỉ xoá dòng do seed demo tạo (created_by = tác giả seed). Gặp dòng do
// người dùng thật tạo thì DỪNG, không xoá — tránh mất dữ liệu nghiệp vụ.
//
// Chạy:
//   npm run seed:official-catalog
//   npm run seed:official-catalog -- --force   (bỏ qua chốt an toàn, chỉ dùng khi đã sao lưu)
import 'reflect-metadata';
import dataSource from '../data-source';
import { AssetCatalogItem } from '../../modules/asset-catalog/entities/asset-catalog-item.entity';
import { Catalog } from '../../modules/master-data/entities/catalog.entity';
import { Material } from '../../modules/master-data/entities/material.entity';

// Mã vật chất demo do seed.ts sinh ra (Gạo, Xăng, Quân phục... — thuộc ngành Quân nhu,
// Xăng dầu, KHÔNG thuộc ngành Doanh trại nên không có mã trong phụ lục này).
const DEMO_MATERIAL_PREFIX = 'VC-';

// Nhóm vật chất và loại công trình tự bịa trong seed.ts — thay bằng nhóm thật của BQP.
const DEMO_CATEGORY_CODES = [
  'LUONG-THUC', 'NHIEN-LIEU', 'QUAN-TRANG', 'VAT-LIEU-XD', 'Y-TE', 'DUNG-CU', 'DIEN-NUOC',
];
const DEMO_FACILITY_TYPE_CODES = [
  'NHA-O', 'NHA-AN', 'KHO', 'NHA-LV', 'SAN', 'HANG-RAO', 'CONG-TRINH-NGAM', 'HA-TANG-KT',
];

const EXPECT = { materials: 788, materialCategories: 96, facilityTypes: 385 };

async function run(): Promise<void> {
  const force = process.argv.slice(2).includes('--force');

  await dataSource.initialize();
  try {
    const itemRepo = dataSource.getRepository(AssetCatalogItem);
    const total = await itemRepo.count({ where: { status: 'ACTIVE' } });
    if (total === 0) {
      throw new Error(
        'Bảng asset_catalog_items rỗng. Chạy `npm run seed:asset-catalog` trước.',
      );
    }
    console.log(`  → Nguồn: ${total} nút danh mục tài sản đang ACTIVE`);

    // ---- Chốt an toàn: phát hiện vật chất do NGƯỜI DÙNG tạo ----
    // Dòng "lạ" = không phải mã demo VC-*, VÀ cũng không phải mã chính thức trong
    // asset_catalog_items. Phải loại trừ mã chính thức, nếu không lần chạy thứ hai
    // sẽ tự chặn chính nó (sau lần đầu, toàn bộ 788 dòng đều mang mã R).
    const foreign = await dataSource.query(
      `SELECT m.code, m.name
         FROM materials m
         LEFT JOIN asset_catalog_items a ON a.code = m.code
        WHERE m.code NOT LIKE $1 AND a.code IS NULL
        LIMIT 10`,
      [`${DEMO_MATERIAL_PREFIX}%`],
    );
    if (foreign.length && !force) {
      throw new Error(
        `Phát hiện ${foreign.length}+ vật chất do người dùng tạo (không phải mã demo ` +
          `"${DEMO_MATERIAL_PREFIX}*" và cũng không có trong danh mục chính thức):\n` +
          foreign.map((r: any) => `    ${r.code} — ${r.name}`).join('\n') +
          '\n  DỪNG để tránh mất dữ liệu nghiệp vụ. Các mã này sẽ KHÔNG bị xoá bởi seeder,' +
          '\n  nhưng hãy rà soát trước. Sao lưu (infra/backup.sh) rồi chạy lại với --force.',
      );
    }

    const nodes = await itemRepo.find({
      where: { status: 'ACTIVE' },
      order: { code: 'ASC' },
    });
    const materialLeaves = nodes.filter((n) => n.domain === 'MATERIAL' && n.isLeaf);
    const materialGroups = nodes.filter((n) => n.domain === 'MATERIAL' && !n.isLeaf);
    const facilityNodes = nodes.filter((n) => n.domain === 'FACILITY');

    if (
      materialLeaves.length !== EXPECT.materials ||
      materialGroups.length !== EXPECT.materialCategories ||
      facilityNodes.length !== EXPECT.facilityTypes
    ) {
      throw new Error(
        'Số lượng nút không như mong đợi — kiểm tra lại bản phụ lục đã nạp:\n' +
          `    vật chất (lá MATERIAL): ${materialLeaves.length}, mong đợi ${EXPECT.materials}\n` +
          `    nhóm vật chất        : ${materialGroups.length}, mong đợi ${EXPECT.materialCategories}\n` +
          `    loại công trình      : ${facilityNodes.length}, mong đợi ${EXPECT.facilityTypes}`,
      );
    }

    await dataSource.transaction(async (manager) => {
      const catalogRepo = manager.getRepository(Catalog);
      const materialRepo = manager.getRepository(Material);

      // ---- 1) Xoá dữ liệu demo ----
      // stock_balances / inventory_transactions tham chiếu material_id bằng cột uuid
      // KHÔNG có ràng buộc FK — phải tự dọn để không bỏ lại dòng mồ côi.
      const delBalances = await manager.query(
        `DELETE FROM stock_balances WHERE material_id IN
           (SELECT id FROM materials WHERE code LIKE $1)`,
        [`${DEMO_MATERIAL_PREFIX}%`],
      );
      const delTxns = await manager.query(
        `DELETE FROM inventory_transactions WHERE material_id IN
           (SELECT id FROM materials WHERE code LIKE $1)`,
        [`${DEMO_MATERIAL_PREFIX}%`],
      );
      await manager.query(
        `DELETE FROM material_versions WHERE material_id IN
           (SELECT id FROM materials WHERE code LIKE $1)`,
        [`${DEMO_MATERIAL_PREFIX}%`],
      );
      const delMaterials = await manager.query(
        `DELETE FROM materials WHERE code LIKE $1`,
        [`${DEMO_MATERIAL_PREFIX}%`],
      );
      await catalogRepo
        .createQueryBuilder()
        .delete()
        .where('type = :t AND code IN (:...codes)', {
          t: 'material-category',
          codes: DEMO_CATEGORY_CODES,
        })
        .execute();
      await catalogRepo
        .createQueryBuilder()
        .delete()
        .where('type = :t AND code IN (:...codes)', {
          t: 'facility-type',
          codes: DEMO_FACILITY_TYPE_CODES,
        })
        .execute();

      console.log(
        `    - Xoá demo: ${delMaterials[1] ?? 0} vật chất · ${delBalances[1] ?? 0} dòng tồn · ` +
          `${delTxns[1] ?? 0} giao dịch · ${DEMO_CATEGORY_CODES.length} nhóm · ` +
          `${DEMO_FACILITY_TYPE_CODES.length} loại công trình`,
      );

      // ---- 2) Nhóm vật chất = nút nhóm miền MATERIAL ----
      for (const node of materialGroups) {
        const existing = await catalogRepo.findOne({
          where: { type: 'material-category', code: node.code },
        });
        const row = existing ?? catalogRepo.create({ type: 'material-category', code: node.code });
        row.name = node.name;
        row.description = node.pathNames;
        row.parentCode = node.parentCode;
        row.sortOrder = node.sourceRow ?? 0;
        row.status = 'PUBLISHED';
        row.effectiveFrom = row.effectiveFrom ?? new Date();
        await catalogRepo.save(row);
      }

      // ---- 3) Loại công trình = toàn bộ nút miền FACILITY (cả nhóm lẫn lá) ----
      // Giữ cả nút nhóm để cây loại công trình duyệt được từ chương xuống.
      for (const node of facilityNodes) {
        const existing = await catalogRepo.findOne({
          where: { type: 'facility-type', code: node.code },
        });
        const row = existing ?? catalogRepo.create({ type: 'facility-type', code: node.code });
        row.name = node.name;
        row.description = node.pathNames;
        row.parentCode = node.parentCode;
        row.sortOrder = node.sourceRow ?? 0;
        row.status = 'PUBLISHED';
        row.effectiveFrom = row.effectiveFrom ?? new Date();
        await catalogRepo.save(row);
      }

      // ---- 4) Vật chất = nút lá miền MATERIAL, mã R là mã chính thức ----
      for (const node of materialLeaves) {
        const existing = await materialRepo.findOne({ where: { code: node.code } });
        const row = existing ?? materialRepo.create({ code: node.code });
        row.name = node.name;
        row.categoryCode = node.parentCode;
        row.unitCode = node.unitCode;
        row.spec = null;
        row.qualityGrade = null;
        // Đưa sẵn ngữ cảnh cây vào attributes để tra cứu/xuất báo cáo không phải join.
        row.attributes = {
          assetPath: node.path,
          assetPathNames: node.pathNames,
          chapter: node.chapter,
          chapterName: node.chapterName,
          level: node.level,
          unitRaw: node.unitRaw,
          sourceRow: node.sourceRow,
        };
        row.status = 'PUBLISHED';
        row.assetCode = node.code;
        row.assetCodeStatus = 'MAPPED';
        await materialRepo.save(row);
      }

      console.log(
        `    + Dựng hình chiếu: ${materialLeaves.length} vật chất · ` +
          `${materialGroups.length} nhóm vật chất · ${facilityNodes.length} loại công trình`,
      );
    });

    // ---- Hậu kiểm từ CSDL ----
    const [chk] = await dataSource.query(`
      SELECT
        (SELECT count(*)::int FROM materials)                                        AS materials,
        (SELECT count(*)::int FROM materials WHERE code LIKE 'VC-%')                 AS demo_left,
        (SELECT count(*)::int FROM materials WHERE asset_code IS NULL)               AS unmapped,
        (SELECT count(*)::int FROM catalogs WHERE type='material-category')          AS categories,
        (SELECT count(*)::int FROM catalogs WHERE type='facility-type')              AS fac_types,
        (SELECT count(*)::int FROM stock_balances sb
           LEFT JOIN materials m ON m.id = sb.material_id WHERE m.id IS NULL)        AS orphan_stock
    `);

    const problems: string[] = [];
    if (chk.materials !== EXPECT.materials) {
      problems.push(`materials = ${chk.materials}, mong đợi ${EXPECT.materials}`);
    }
    if (chk.demo_left !== 0) problems.push(`còn ${chk.demo_left} vật chất demo`);
    if (chk.orphan_stock !== 0) problems.push(`còn ${chk.orphan_stock} dòng tồn mồ côi`);
    if (chk.categories !== EXPECT.materialCategories) {
      problems.push(`material-category = ${chk.categories}, mong đợi ${EXPECT.materialCategories}`);
    }
    if (chk.fac_types !== EXPECT.facilityTypes) {
      problems.push(`facility-type = ${chk.fac_types}, mong đợi ${EXPECT.facilityTypes}`);
    }
    if (problems.length) {
      throw new Error('Hậu kiểm thất bại:\n' + problems.map((p) => `    - ${p}`).join('\n'));
    }

    console.log('\n  Hậu kiểm CSDL:');
    console.log(
      `    vật chất ${chk.materials} (demo còn lại ${chk.demo_left}, chưa gắn mã ${chk.unmapped}) · ` +
        `nhóm ${chk.categories} · loại công trình ${chk.fac_types} · tồn mồ côi ${chk.orphan_stock}`,
    );
    console.log(
      '\n  LƯU Ý: tồn kho demo đã xoá cùng vật chất demo. Để tạo lại dữ liệu tồn kho mô phỏng\n' +
        '  trên mã chính thức: xoá bảng storage_locations rồi chạy `npm run seed`.',
    );
    console.log(
      '  Công trình demo giữ nguyên, cột asset_code để trống — xuất hiện ở màn "Rà soát thiếu mã".',
    );
    console.log('\n  Thay danh mục chính thức hoàn tất. RÀ SOÁT: Danh mục vật chất (/materials).');
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('\nSeed danh mục chính thức LỖI:\n' + (err?.message ?? err));
  process.exit(1);
});
