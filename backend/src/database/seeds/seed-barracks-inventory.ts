// Seed "Trang bị & Vật chất" cho MỌI doanh trại: mỗi doanh trại có ≥2 kho (gắn barracks_id + địa
// bàn + đơn vị để lọc theo phạm vi) và danh mục tồn kho phong phú lấy từ bảng `materials` (danh mục
// R00 — trang bị/vật chất doanh trại). Tab "Trang bị & Vật chất" ở /barracks/:id đọc:
//   storage_locations (barracks_id) → /inventory/balances (stock_balances JOIN materials).
// Idempotent: kho UPSERT theo code; tồn UPSERT theo (material_id, storage_location_id).
import 'reflect-metadata';
import dataSource from '../data-source';
import { Barracks } from '../../modules/barracks/entities/barracks.entity';
import { Material } from '../../modules/master-data/entities/material.entity';
import { StorageLocation } from '../../modules/inventory/entities/storage-location.entity';
import { StockBalance } from '../../modules/inventory/entities/stock-balance.entity';
import { WorkflowStatus } from '../../common/workflow';

// RNG tất định theo chuỗi (để số lượng ổn định giữa các lần chạy).
function seededRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Chọn `count` vật chất trải đều theo danh mục (stride) từ danh sách đã sắp, lệch theo doanh trại.
function pickMaterials(all: Material[], startOffset: number, count: number, step: number): Material[] {
  const out: Material[] = [];
  const seen = new Set<string>();
  for (let k = 0; k < count; k++) {
    const idx = (startOffset + k * step) % all.length;
    const m = all[idx];
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

interface KhoDef {
  suffix: string;
  name: (b: Barracks) => string;
  nganh: string;
  count: number;
  step: number;
  offsetShift: number;
}

const KHO_DEFS: KhoDef[] = [
  { suffix: '', name: (b) => `Kho tổng hợp – ${b.name}`, nganh: 'QN', count: 26, step: 29, offsetShift: 0 },
  { suffix: '-DC', name: (b) => `Kho doanh cụ & trang bị – ${b.name}`, nganh: 'XD', count: 18, step: 41, offsetShift: 5 },
];

async function run() {
  await dataSource.initialize();
  const barracksRepo = dataSource.getRepository(Barracks);
  const materialRepo = dataSource.getRepository(Material);
  const locationRepo = dataSource.getRepository(StorageLocation);
  const balanceRepo = dataSource.getRepository(StockBalance);

  const barracksList = await barracksRepo.find({ order: { code: 'ASC' } });
  const materials = await materialRepo.find({ order: { code: 'ASC' } });
  if (materials.length === 0) {
    console.error('Bảng materials trống — hãy chạy seed danh mục R00 trước (seed:official-catalog / seed:thanh-hoa).');
    await dataSource.destroy();
    process.exit(1);
  }

  let khoCreated = 0;
  let khoExisting = 0;
  let balCreated = 0;

  for (let i = 0; i < barracksList.length; i++) {
    const b = barracksList[i];
    for (const def of KHO_DEFS) {
      const code = `KHO-${b.code}${def.suffix}`;
      let loc = await locationRepo.findOne({ where: { code } });
      if (!loc) {
        loc = await locationRepo.save(
          locationRepo.create({
            code,
            name: def.name(b),
            type: 'KHO_DOANH_TRAI',
            nganh: def.nganh,
            cap: 'DOANH_TRAI',
            siteType: 'XA',
            capacityTons: '150.00',
            barracksId: b.id,
            areaId: b.areaId,
            organizationId: b.organizationId,
            status: 'ACTIVE',
            workflowStatus: WorkflowStatus.APPROVED,
          }),
        );
        khoCreated++;
      } else {
        khoExisting++;
      }

      // Tồn kho: chọn vật chất trải đều, số lượng tất định theo (kho × vật chất).
      const startOffset = (i * 13 + def.offsetShift) % materials.length;
      const picks = pickMaterials(materials, startOffset, def.count, def.step);
      for (const m of picks) {
        const exists = await balanceRepo.findOne({ where: { storageLocationId: loc.id, materialId: m.id } });
        if (exists) continue;
        const rng = seededRng(`${code}|${m.code}`);
        const onHand = 20 + Math.floor(rng() * 1480); // 20 .. 1499
        // ~40% có số kiểm kê gần nhất (tạo chênh lệch để thấy cột "Chênh lệch").
        const counted = rng() < 0.4 ? Math.max(0, onHand + (Math.floor(rng() * 60) - 25)) : null;
        await balanceRepo.save(
          balanceRepo.create({
            storageLocationId: loc.id,
            materialId: m.id,
            onHand: onHand.toFixed(3),
            lastCounted: counted !== null ? counted.toFixed(3) : null,
          }),
        );
        balCreated++;
      }
    }
  }

  // ── Nguồn cấp Tỉnh (Feature 01) ──────────────────────────────────────────
  // Tạo kho ở các loại địa điểm nguồn khác XÃ để trang "Vật chất thường xuyên của Tỉnh"
  // có đủ cơ cấu: kho Tỉnh, đơn vị trực thuộc, căn cứ chiến đấu, phân căn cứ, căn cứ HC-KT mật.
  // Không gắn areaId (nguồn cấp Tỉnh, không thuộc 1 xã). Idempotent theo mã kho.
  const PROVINCE_SOURCES: { code: string; name: string; siteType: string; nganh: string; count: number; step: number }[] = [
    { code: 'KHO-TINH-01', name: 'Kho hậu cần Tỉnh 01', siteType: 'KHO_TINH', nganh: 'QN', count: 40, step: 17 },
    { code: 'KHO-TINH-02', name: 'Kho kỹ thuật Tỉnh 02', siteType: 'KHO_TINH', nganh: 'KT', count: 34, step: 23 },
    { code: 'KHO-DVTT-01', name: 'Kho Trung đoàn địa phương (đơn vị trực thuộc)', siteType: 'DON_VI_TRUC_THUOC', nganh: 'QN', count: 30, step: 19 },
    { code: 'KHO-CCCD-01', name: 'Căn cứ chiến đấu số 1', siteType: 'CAN_CU_CHIEN_DAU', nganh: 'VT', count: 24, step: 31 },
    { code: 'KHO-PCC-01', name: 'Phân căn cứ A', siteType: 'PHAN_CAN_CU', nganh: 'LT', count: 18, step: 37 },
    { code: 'KHO-CCHCKT-01', name: 'Căn cứ HC-KT (mật) K1', siteType: 'CAN_CU_HCKT_BI_MAT', nganh: 'KT', count: 20, step: 29 },
  ];
  let provCreated = 0;
  for (let si = 0; si < PROVINCE_SOURCES.length; si++) {
    const src = PROVINCE_SOURCES[si];
    let loc = await locationRepo.findOne({ where: { code: src.code } });
    if (!loc) {
      loc = await locationRepo.save(
        locationRepo.create({
          code: src.code,
          name: src.name,
          type: 'KHO_TINH',
          nganh: src.nganh,
          cap: 'TINH',
          siteType: src.siteType,
          capacityTons: '500.00',
          barracksId: null,
          areaId: null,
          organizationId: null,
          status: 'ACTIVE',
          workflowStatus: WorkflowStatus.APPROVED,
        }),
      );
      provCreated++;
    } else if (loc.siteType !== src.siteType) {
      loc.siteType = src.siteType;
      await locationRepo.save(loc);
    }
    const startOffset = (si * 53) % materials.length;
    const picks = pickMaterials(materials, startOffset, src.count, src.step);
    for (const m of picks) {
      const exists = await balanceRepo.findOne({ where: { storageLocationId: loc.id, materialId: m.id } });
      if (exists) continue;
      const rng = seededRng(`${src.code}|${m.code}`);
      const onHand = 50 + Math.floor(rng() * 4950); // 50 .. 4999 (nguồn cấp Tỉnh lớn hơn)
      await balanceRepo.save(
        balanceRepo.create({
          storageLocationId: loc.id,
          materialId: m.id,
          onHand: onHand.toFixed(3),
          lastCounted: null,
        }),
      );
      balCreated++;
    }
  }

  console.log(
    `Barracks inventory seed: ${barracksList.length} doanh trại; kho mới=${khoCreated} (đã có=${khoExisting}); ` +
      `nguồn cấp Tỉnh mới=${provCreated}/${PROVINCE_SOURCES.length}; ` +
      `dòng tồn kho mới=${balCreated}. Nguồn vật chất: ${materials.length} mã (materials/R00).`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
