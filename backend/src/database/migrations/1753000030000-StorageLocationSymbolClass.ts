import { MigrationInterface, QueryRunner } from 'typeorm';

// Phân loại kho theo ĐIỀU LỆ KÝ HIỆU QUÂN SỰ (09-2011, Mục S — Hậu cần; xem REF-2026-003)
// để chọn đúng ký hiệu trên bản đồ số P08 (biểu tượng kho trạm hậu cần).
//   - nganh        : ngành hậu cần = chữ ghi TRONG ký hiệu (LT/XD/QN/QY/VT/DAN/TH/KT).
//   - cap          : cấp quản lý  = quyết HÌNH NỀN ký hiệu (TINH/HUYEN/XA/DOANH_TRAI/QK/QD/F/E/D/C).
//   - capacity_tons: khối lượng (tấn) ghi trong ký hiệu.
// Cột nullable → an toàn với storage_location_revisions & bản ghi cũ. Backfill suy từ `type`
// (loại kho hiện có) và `barracks_id`/cấp địa bàn để dữ liệu cũ vẫn hiện đúng ký hiệu.
export class StorageLocationSymbolClass1753000030000 implements MigrationInterface {
  name = 'StorageLocationSymbolClass1753000030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "nganh" varchar`,
    );
    await queryRunner.query(`ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "cap" varchar`);
    await queryRunner.query(
      `ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "capacity_tons" numeric(12,2)`,
    );

    // Backfill ngành từ loại kho hiện có (catalogs.type='storage-location-type').
    await queryRunner.query(`
      UPDATE "storage_locations" SET "nganh" = CASE "type"
        WHEN 'KHO-LUONG' THEN 'LT'
        WHEN 'KHO-NHIEN' THEN 'XD'
        WHEN 'KHO-KT'    THEN 'KT'
        WHEN 'KHO-TONG'  THEN 'TH'
        ELSE 'TH' END
      WHERE "nganh" IS NULL
    `);

    // Backfill cấp: có doanh trại → DOANH_TRAI; theo cấp địa bàn (PROVINCE→TINH, COMMUNE→XA).
    await queryRunner.query(`
      UPDATE "storage_locations" s SET "cap" = CASE
        WHEN s."barracks_id" IS NOT NULL THEN 'DOANH_TRAI'
        WHEN a."level" = 'PROVINCE' THEN 'TINH'
        WHEN a."level" = 'COMMUNE'  THEN 'XA'
        ELSE 'XA' END
      FROM "administrative_areas" a
      WHERE s."cap" IS NULL AND a."id" = s."area_id"
    `);
    // Kho không gắn địa bàn: có doanh trại → DOANH_TRAI, còn lại mặc định XA (cấp cơ sở).
    await queryRunner.query(`
      UPDATE "storage_locations" SET "cap" =
        CASE WHEN "barracks_id" IS NOT NULL THEN 'DOANH_TRAI' ELSE 'XA' END
      WHERE "cap" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "capacity_tons"`);
    await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "cap"`);
    await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "nganh"`);
  }
}
