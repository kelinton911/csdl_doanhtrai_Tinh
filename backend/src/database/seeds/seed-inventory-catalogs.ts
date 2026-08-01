// Seed danh mục chung cho các chiều dữ liệu kiểm kê bổ sung (ADR 2026-08-01):
//   - reserve-purpose      : 6 mục đích dự trữ của bộ biểu 01–06/KKDT
//   - location-class       : 3 vị trí (đang dùng / kho Bộ-Ngành / kho đơn vị) của biểu 03/KK
//   - stock-quality-grade  : phân cấp Cấp 1–5 của biểu 03/KK, 02–06/KKDT
// TÁCH RIÊNG khỏi 'quality-grade' (TOT/KHA/TRUNG_BINH/KEM) đang dùng cho cấp chất lượng
// công trình/vật chất — không đụng vào để giữ nguyên các dropdown hiện có.
// Idempotent: bỏ qua mục đã có theo (type, code).
import 'reflect-metadata';
import dataSource from '../data-source';
import { Catalog } from '../../modules/master-data/entities/catalog.entity';

const GROUPS: Array<{ type: string; items: Array<[string, string]> }> = [
  {
    type: 'reserve-purpose',
    items: [
      ['THUONG_XUYEN', 'Thường xuyên'],
      ['SSCD', 'Dự trữ sẵn sàng chiến đấu'],
      ['DOT_XUAT', 'Dự trữ nhiệm vụ đột xuất'],
      ['GOI_DAU', 'Gối đầu thường xuyên'],
      ['THU_HOI_XU_LY', 'Thu hồi, hư hỏng chờ thanh xử lý'],
      ['CHAM_LUAN_CHUYEN', 'Chậm luân chuyển'],
    ],
  },
  {
    type: 'location-class',
    items: [
      ['DANG_SU_DUNG', 'Đang sử dụng'],
      ['KHO_BO_NGANH', 'Kho Bộ, Ngành'],
      ['KHO_DON_VI', 'Kho đơn vị'],
    ],
  },
  {
    type: 'stock-quality-grade',
    items: [
      ['CAP_1', 'Cấp 1'],
      ['CAP_2', 'Cấp 2'],
      ['CAP_3', 'Cấp 3'],
      ['CAP_4', 'Cấp 4'],
      ['CAP_5', 'Cấp 5'],
    ],
  },
];

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(Catalog);
  let created = 0;
  let skipped = 0;
  for (const g of GROUPS) {
    for (let i = 0; i < g.items.length; i++) {
      const [code, name] = g.items[i];
      if (await repo.findOne({ where: { type: g.type, code } })) {
        skipped++;
        continue;
      }
      await repo.save(
        repo.create({
          type: g.type,
          code,
          name,
          sortOrder: i,
          status: 'PUBLISHED',
          effectiveFrom: new Date(),
        }),
      );
      created++;
    }
  }
  console.log(
    `Seed danh mục kiểm kê (reserve-purpose/location-class/stock-quality-grade): +${created} mục (bỏ qua ${skipped}).`,
  );
  await dataSource.destroy();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
