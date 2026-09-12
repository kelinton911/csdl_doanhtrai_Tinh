import { MigrationInterface, QueryRunner } from 'typeorm';

// Feature 01 — Thêm "loại địa điểm nguồn" (site_type) cho kho để tách "nguồn vật chất
// thường xuyên của Tỉnh" theo từng loại nguồn (xã/đơn vị/kho Tỉnh/căn cứ...).
// Backfill suy từ cột `cap` hiện có (TINH→KHO_TINH, XA→XA, DOANH_TRAI→XA).
export class StorageSiteType1753000053000 implements MigrationInterface {
  name = 'StorageSiteType1753000053000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "site_type" varchar');
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_storage_locations_site_type" ON "storage_locations" ("site_type")',
    );
    // Backfill từ cấp quản lý kho (cap) khi chưa có site_type.
    await queryRunner.query(`
      UPDATE "storage_locations" SET "site_type" = CASE "cap"
        WHEN 'TINH' THEN 'KHO_TINH'
        WHEN 'XA' THEN 'XA'
        WHEN 'DOANH_TRAI' THEN 'XA'
        ELSE "site_type"
      END
      WHERE "site_type" IS NULL AND "cap" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_storage_locations_site_type"');
    await queryRunner.query('ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "site_type"');
  }
}
