// Feature 02 (KVPT) — Danh mục "Tiềm lực địa phương": nhóm vật chất huy động từ nền kinh tế
// địa phương (xăng dầu, phương tiện vận tải, lương thực, y tế, nhân lực, cơ sở SX-SC).
// Nạp thành một phiên bản material_catalog PUBLISHED riêng để picker KVPT tra cứu SONG SONG
// với danh mục chuẩn (R00/Quân nhu). Idempotent theo version_code.
import 'reflect-metadata';
import dataSource from '../data-source';
import { UnitOfMeasure } from '../../modules/catalog/entities/unit-of-measure.entity';
import { CatalogVersion } from '../../modules/catalog/entities/catalog-version.entity';
import { MaterialCatalog } from '../../modules/catalog/entities/material-catalog.entity';
import { CatalogVersionStatus } from '../../common/enums';
import { normalizeText } from '../../common/tabular';

const VERSION_CODE = 'TIEM-LUC-DP-2026';

const UNITS = [
  { code: 'LIT', name: 'Lít', symbol: 'lít', unitType: 'VOLUME' },
  { code: 'M3', name: 'Mét khối', symbol: 'm³', unitType: 'VOLUME' },
  { code: 'TAN', name: 'Tấn', symbol: 'tấn', unitType: 'WEIGHT' },
  { code: 'CHIEC', name: 'Chiếc', symbol: 'chiếc', unitType: 'COUNT' },
  { code: 'NGUOI', name: 'Người', symbol: 'người', unitType: 'COUNT' },
  { code: 'GIUONG', name: 'Giường', symbol: 'giường', unitType: 'COUNT' },
  { code: 'COSO', name: 'Cơ sở', symbol: 'cơ sở', unitType: 'COUNT' },
];

// Cây tiềm lực địa phương (mã, tên, mã cha, ĐVT).
const TREE: Array<{ code: string; name: string; parent?: string; unit?: string }> = [
  { code: 'TLDP.01', name: 'Xăng dầu - nhiên liệu' },
  { code: 'TLDP.01.01', name: 'Xăng RON95', parent: 'TLDP.01', unit: 'LIT' },
  { code: 'TLDP.01.02', name: 'Dầu Diesel (DO)', parent: 'TLDP.01', unit: 'LIT' },
  { code: 'TLDP.01.03', name: 'Dầu hỏa', parent: 'TLDP.01', unit: 'LIT' },

  { code: 'TLDP.02', name: 'Phương tiện vận tải' },
  { code: 'TLDP.02.01', name: 'Ô tô tải', parent: 'TLDP.02', unit: 'CHIEC' },
  { code: 'TLDP.02.02', name: 'Xe khách', parent: 'TLDP.02', unit: 'CHIEC' },
  { code: 'TLDP.02.03', name: 'Tàu/thuyền vận tải', parent: 'TLDP.02', unit: 'CHIEC' },

  { code: 'TLDP.03', name: 'Lương thực - thực phẩm địa phương' },
  { code: 'TLDP.03.01', name: 'Gạo', parent: 'TLDP.03', unit: 'TAN' },
  { code: 'TLDP.03.02', name: 'Thịt gia súc/gia cầm', parent: 'TLDP.03', unit: 'TAN' },
  { code: 'TLDP.03.03', name: 'Rau xanh', parent: 'TLDP.03', unit: 'TAN' },

  { code: 'TLDP.04', name: 'Y tế - quân y' },
  { code: 'TLDP.04.01', name: 'Giường bệnh huy động', parent: 'TLDP.04', unit: 'GIUONG' },
  { code: 'TLDP.04.02', name: 'Cơ sở y tế huy động', parent: 'TLDP.04', unit: 'COSO' },

  { code: 'TLDP.05', name: 'Nhân lực' },
  { code: 'TLDP.05.01', name: 'Dân quân tự vệ', parent: 'TLDP.05', unit: 'NGUOI' },
  { code: 'TLDP.05.02', name: 'Lực lượng dự bị động viên', parent: 'TLDP.05', unit: 'NGUOI' },

  { code: 'TLDP.06', name: 'Cơ sở sản xuất - sửa chữa' },
  { code: 'TLDP.06.01', name: 'Xưởng cơ khí/sửa chữa', parent: 'TLDP.06', unit: 'COSO' },
  { code: 'TLDP.06.02', name: 'Kho dân sự huy động', parent: 'TLDP.06', unit: 'COSO' },
];

async function run() {
  await dataSource.initialize();
  const unitRepo = dataSource.getRepository(UnitOfMeasure);
  const versionRepo = dataSource.getRepository(CatalogVersion);
  const itemRepo = dataSource.getRepository(MaterialCatalog);

  const unitIdByCode = new Map<string, string>();
  for (const u of UNITS) {
    let unit = await unitRepo.findOne({ where: { code: u.code } });
    if (!unit) unit = await unitRepo.save(unitRepo.create(u as Partial<UnitOfMeasure>));
    unitIdByCode.set(u.code, unit.id);
  }

  let version = await versionRepo.findOne({ where: { versionCode: VERSION_CODE } });
  if (!version) {
    version = await versionRepo.save(
      versionRepo.create({
        versionCode: VERSION_CODE,
        versionName: 'Danh mục tiềm lực địa phương (KVPT) 2026',
        status: CatalogVersionStatus.DRAFT,
        effectiveFrom: '2026-01-01',
      }),
    );
  }

  const idByCode = new Map<string, string>();
  let created = 0;
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
          searchKey: normalizeText(node.name),
        }),
      );
      created++;
    }
    idByCode.set(node.code, item.id);
  }

  if (version.status === CatalogVersionStatus.DRAFT) {
    version.status = CatalogVersionStatus.PUBLISHED;
    version.publishedAt = new Date();
    await versionRepo.save(version);
  }

  console.log(
    `KVPT local-potential catalog seed: version ${VERSION_CODE} (${version.status}); ` +
      `mã mới=${created}/${TREE.length}; ĐVT=${UNITS.length}.`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
