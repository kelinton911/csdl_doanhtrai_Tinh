// Nạp TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI (1272 mã, 6 cấp) vào asset_catalog_items.
// Nguồn: Phụ lục kèm Công văn 2837/DT-QLDT ngày 16/7/2026 — Cục Doanh trại/TCHC-KT.
//
// KHÔNG bịa dữ liệu: seeder chỉ đọc file JSON đã chốt hash (4 cột đúng như văn bản gốc),
// TUYỆT ĐỐI không đọc PDF — mọi thay đổi nguồn phải đi qua scripts/extract_asset_catalog.py
// và được soát trong diff của file JSON.
//
// Idempotent: upsert theo `code`, chạy lại an toàn. Dẫn xuất tất định nên chạy lại
// cho kết quả y hệt (trừ updated_at).
//
// Chạy:
//   npm run seed:asset-catalog
//   npm run seed:asset-catalog -- <duong/dan.json>
//   ASSET_CATALOG_FILE=<duong/dan.json> npm run seed:asset-catalog
import 'reflect-metadata';
import * as fs from 'fs';
import { createHash } from 'crypto';
import { basename, isAbsolute, join } from 'path';
import dataSource from '../data-source';
import { AssetCatalogItem } from '../../modules/asset-catalog/entities/asset-catalog-item.entity';
import { Catalog } from '../../modules/master-data/entities/catalog.entity';
import {
  CODE_RE,
  DerivedAssetNode,
  RawAssetRow,
  deriveTree,
} from '../../modules/asset-catalog/asset-code.util';

// ---------------------------------------------------------------------------
// Chốt toàn vẹn — rút từ chính văn bản gốc. Lệch bất kỳ số nào là DỪNG, không cảnh báo.
// Khi Cục Doanh trại ban hành phụ lục mới, các số này phải được cập nhật CÓ CHỦ Ý.
// ---------------------------------------------------------------------------
const EXPECT = {
  total: 1272,
  levels: { 0: 1, 1: 5, 2: 14, 3: 28, 4: 71, 5: 116, 6: 1037 } as Record<number, number>,
  leaves: 1081,
  groups: 191,
  unitOnGroup: 17,
  chapters: 17,
  // Chương VI KHÔNG có trong phụ lục. Assert sự vắng mặt để bản mới thêm VI sẽ
  // báo động thay vì âm thầm đổi hành vi của các bộ lọc theo chương.
  absentChapter: 'VI',
  domains: { ROOT: 1, FACILITY: 385, MATERIAL: 884, UNCLASSIFIED: 2 } as Record<string, number>,
};

// ---------------------------------------------------------------------------
// Chuẩn hoá ĐVT. `unit_raw` vẫn giữ NGUYÊN VĂN — bảng này chỉ phục vụ lọc/nhóm nội bộ,
// nên chuẩn hoá sai cũng KHÔNG THỂ rò ra file nộp Cục Doanh trại.
// Giá trị lạ là LỖI CỨNG, không phải cảnh báo: thà dừng còn hơn nạp NULL âm thầm.
// ---------------------------------------------------------------------------
const UNIT_MAP: Record<string, string> = {
  'Cái': 'CAI', 'cái': 'CAI',
  'Chiếc': 'CHIEC',
  'Bộ': 'BO', 'bộ': 'BO',
  'm': 'M', 'M': 'M',
  'm2': 'M2', 'M2': 'M2',
  'm3': 'M3', 'M3': 'M3',
  'Kg': 'KG', 'kg': 'KG',
  'Lít': 'LIT',
  'm2 SD': 'M2_SD',
  'HT': 'HT', 'Hệ thống': 'HT',
  'TB': 'TB',
  'Trạm': 'TRAM',
  'Sợi': 'SOI',
};

// 6 đơn vị tính mới so với bộ seed sẵn có (KG,TAN,CAI,BO,LIT,M,M2,M3,THUNG,VIEN).
const NEW_UNITS: Array<[string, string]> = [
  ['M2_SD', 'Mét vuông sử dụng'],
  ['HT', 'Hệ thống'],
  ['TB', 'Thiết bị'],
  ['CHIEC', 'Chiếc'],
  ['TRAM', 'Trạm'],
  ['SOI', 'Sợi'],
];

const UNIT_SOURCE_NOTE = 'Nguồn: Phụ lục kèm CV 2837/DT-QLDT ngày 16/7/2026';

function resolveFile(): string {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const fromEnv = (process.env.ASSET_CATALOG_FILE ?? '').trim();
  const picked = argv[0] || fromEnv || join(__dirname, 'data', 'asset-catalog-2026.json');
  return isAbsolute(picked) ? picked : join(process.cwd(), picked);
}

/** Đối chiếu sidecar .sha256 nếu có — chặn nạp nhầm file đã bị sửa tay. */
function verifySha(path: string, digest: string): void {
  const sidecar = `${path}.sha256`;
  if (!fs.existsSync(sidecar)) return;
  const expected = fs.readFileSync(sidecar, 'utf8').trim().split(/\s+/)[0];
  if (expected !== digest) {
    throw new Error(
      `SHA-256 không khớp sidecar.\n  file    : ${digest}\n  sidecar : ${expected}\n` +
        'File nguồn đã bị sửa. Chạy lại scripts/extract_asset_catalog.py và soát diff.',
    );
  }
}

/** Chặn mọi sai lệch TRƯỚC khi ghi DB. Ném lỗi kèm danh sách cụ thể. */
function assertIntegrity(nodes: DerivedAssetNode[]): void {
  const errors: string[] = [];
  const codes = new Set(nodes.map((n) => n.code));

  if (nodes.length !== EXPECT.total) {
    errors.push(`Số nút = ${nodes.length}, mong đợi ${EXPECT.total}`);
  }
  if (codes.size !== nodes.length) {
    errors.push(`Mã trùng: ${nodes.length - codes.size} dòng`);
  }

  const badCode = nodes.filter((n) => !CODE_RE.test(n.code)).map((n) => n.code);
  if (badCode.length) errors.push(`Mã sai định dạng (${badCode.length}): ${badCode.slice(0, 5)}`);

  const orphans = nodes.filter((n) => n.parentCode && !codes.has(n.parentCode));
  if (orphans.length) {
    errors.push(
      `Nút mồ côi (${orphans.length}): ` +
        orphans.slice(0, 5).map((n) => `${n.code}→${n.parentCode}`).join(', '),
    );
  }

  const levels: Record<number, number> = {};
  nodes.forEach((n) => { levels[n.level] = (levels[n.level] ?? 0) + 1; });
  for (const [level, count] of Object.entries(EXPECT.levels)) {
    if (levels[Number(level)] !== count) {
      errors.push(`Cấp ${level}: ${levels[Number(level)] ?? 0} nút, mong đợi ${count}`);
    }
  }

  const leaves = nodes.filter((n) => n.isLeaf).length;
  if (leaves !== EXPECT.leaves) errors.push(`Nút lá = ${leaves}, mong đợi ${EXPECT.leaves}`);
  const groups = nodes.length - leaves;
  if (groups !== EXPECT.groups) errors.push(`Nút nhóm = ${groups}, mong đợi ${EXPECT.groups}`);

  const dual = nodes.filter((n) => n.unitOnGroup).length;
  if (dual !== EXPECT.unitOnGroup) {
    errors.push(`Nút vừa có ĐVT vừa có con = ${dual}, mong đợi ${EXPECT.unitOnGroup}`);
  }

  const chapters = new Set(nodes.map((n) => n.chapter).filter(Boolean));
  if (chapters.size !== EXPECT.chapters) {
    errors.push(`Số chương = ${chapters.size}, mong đợi ${EXPECT.chapters}`);
  }
  if (chapters.has(EXPECT.absentChapter)) {
    errors.push(
      `Chương ${EXPECT.absentChapter} xuất hiện — phụ lục gốc KHÔNG có chương này. ` +
        'Nếu bản mới đã bổ sung, hãy cập nhật EXPECT một cách có chủ ý.',
    );
  }

  const domains: Record<string, number> = {};
  nodes.forEach((n) => { domains[n.domain] = (domains[n.domain] ?? 0) + 1; });
  for (const [domain, count] of Object.entries(EXPECT.domains)) {
    if (domains[domain] !== count) {
      errors.push(`Miền ${domain}: ${domains[domain] ?? 0} nút, mong đợi ${count}`);
    }
  }

  const unknownUnits = [
    ...new Set(nodes.map((n) => n.unitRaw).filter((u): u is string => !!u && !UNIT_MAP[u])),
  ];
  if (unknownUnits.length) {
    errors.push(`ĐVT chưa có trong bảng ánh xạ: ${JSON.stringify(unknownUnits)}`);
  }

  const sorted = [...nodes].map((n) => n.code);
  if (sorted.join('|') !== [...sorted].sort().join('|')) {
    errors.push('Thứ tự nút không trùng thứ tự mã (deriveTree phải trả về đã sắp xếp)');
  }

  if (errors.length) {
    throw new Error(
      `KIỂM TRA TOÀN VẸN THẤT BẠI (${errors.length} lỗi) — KHÔNG ghi gì vào CSDL:\n` +
        errors.map((e) => `  - ${e}`).join('\n'),
    );
  }
}

async function run(): Promise<void> {
  const file = resolveFile();
  if (!fs.existsSync(file)) {
    throw new Error(
      `Không thấy file dữ liệu: ${file}\n` +
        'Tạo bằng: python scripts/extract_asset_catalog.py\n' +
        'Hoặc truyền đường dẫn: npm run seed:asset-catalog -- <path>',
    );
  }

  const bytes = fs.readFileSync(file);
  const sourceSha = createHash('sha256').update(bytes).digest('hex');
  verifySha(file, sourceSha);

  const payload = JSON.parse(bytes.toString('utf8'));
  const items: RawAssetRow[] = payload?.items;
  if (!Array.isArray(items) || !items.length) {
    throw new Error(`File không hợp lệ (${basename(file)}): thiếu mảng "items".`);
  }
  const revision: string = payload?.meta?.revision ?? 'UNKNOWN';
  const sourceDoc: string = payload?.meta?.sourceDoc ?? basename(file);

  console.log(`  → Nạp ${basename(file)} (${items.length} dòng, bản ${revision})`);
  console.log(`    sha256 ${sourceSha}`);

  const nodes = deriveTree(items);
  assertIntegrity(nodes);
  console.log('    Kiểm tra toàn vẹn: ĐẠT (1272 nút · 0 mồ côi · 17 chương · 17 nút ĐVT-trên-nhóm)');

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const catalogRepo = manager.getRepository(Catalog);
      const itemRepo = manager.getRepository(AssetCatalogItem);

      // 1) Bổ sung đơn vị tính mới (upsert theo type+code — chạy lại an toàn).
      let unitsAdded = 0;
      for (const [code, name] of NEW_UNITS) {
        const existing = await catalogRepo.findOne({
          where: { type: 'unit-of-measure', code },
        });
        if (existing) continue;
        await catalogRepo.save(
          catalogRepo.create({
            type: 'unit-of-measure',
            code,
            name,
            description: UNIT_SOURCE_NOTE,
            status: 'PUBLISHED',
            effectiveFrom: new Date(),
            sortOrder: 100 + unitsAdded,
          }),
        );
        unitsAdded++;
      }

      // 2) Upsert từng nút danh mục theo `code`.
      for (const node of nodes) {
        const existing = await itemRepo.findOne({ where: { code: node.code } });
        const row = existing ?? itemRepo.create({ code: node.code });
        row.name = node.name;
        row.searchText = node.searchText;
        row.parentCode = node.parentCode;
        row.level = node.level;
        row.path = node.path;
        row.pathNames = node.pathNames;
        row.isLeaf = node.isLeaf;
        row.childCount = node.childCount;
        row.unitRaw = node.unitRaw;
        row.unitCode = node.unitRaw ? (UNIT_MAP[node.unitRaw] ?? null) : null;
        row.unitOnGroup = node.unitOnGroup;
        row.chapter = node.chapter;
        row.chapterName = node.chapterName;
        row.domain = node.domain;
        row.duplicateGroup = node.duplicateGroup;
        row.sourceDoc = sourceDoc;
        row.sourceRow = node.stt;
        row.sourceSha = sourceSha;
        row.revision = revision;
        row.status = 'ACTIVE';
        await itemRepo.save(row);
      }

      // 3) Mã của bản cũ không còn trong bản này → SUPERSEDED (không xoá cứng).
      const superseded = await itemRepo
        .createQueryBuilder()
        .update()
        .set({ status: 'SUPERSEDED' })
        .where('source_sha <> :sha AND status = :active', { sha: sourceSha, active: 'ACTIVE' })
        .execute();

      console.log(`    + Đơn vị tính mới: ${unitsAdded}`);
      console.log(`    + Nút danh mục upsert: ${nodes.length}`);
      if (superseded.affected) {
        console.log(`    + Đánh dấu SUPERSEDED (bản cũ): ${superseded.affected}`);
      }
    });

    // 4) Đọc lại TỪ CSDL để kiểm chứng — không tin bộ nhớ.
    const itemRepo = dataSource.getRepository(AssetCatalogItem);
    const total = await itemRepo.count({ where: { status: 'ACTIVE' } });
    const [{ orphans }] = await dataSource.query(`
      SELECT count(*)::int AS orphans
      FROM asset_catalog_items c
      LEFT JOIN asset_catalog_items p ON p.code = c.parent_code
      WHERE c.parent_code IS NOT NULL AND p.code IS NULL
    `);
    const levelRows = await dataSource.query(
      'SELECT level, count(*)::int AS n FROM asset_catalog_items GROUP BY level ORDER BY level',
    );
    const domainRows = await dataSource.query(
      'SELECT domain, count(*)::int AS n FROM asset_catalog_items GROUP BY domain ORDER BY domain',
    );
    const [{ shas }] = await dataSource.query(
      'SELECT count(DISTINCT source_sha)::int AS shas FROM asset_catalog_items',
    );

    if (total !== EXPECT.total || orphans !== 0) {
      throw new Error(
        `Hậu kiểm CSDL thất bại: ${total} nút ACTIVE (mong đợi ${EXPECT.total}), ${orphans} mồ côi.`,
      );
    }

    console.log('\n  Hậu kiểm CSDL:');
    console.log(`    tổng ACTIVE ${total} · mồ côi ${orphans} · số bản (source_sha) ${shas}`);
    console.log(
      '    cấp  ' + levelRows.map((r: any) => `${r.level}:${r.n}`).join(' · '),
    );
    console.log(
      '    miền ' + domainRows.map((r: any) => `${r.domain}:${r.n}`).join(' · '),
    );

    const dupGroups = await dataSource.query(
      'SELECT count(DISTINCT duplicate_group)::int AS n FROM asset_catalog_items WHERE duplicate_group IS NOT NULL',
    );
    console.log(`    nhóm trùng tên khác chương: ${dupGroups[0].n} (cảnh báo, KHÔNG khử trùng)`);

    console.log(
      '\n  Nạp danh mục tài sản hoàn tất. RÀ SOÁT: Danh mục tài sản BQP (/asset-catalog).',
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('\nSeed danh mục tài sản LỖI:\n' + (err?.message ?? err));
  process.exit(1);
});
