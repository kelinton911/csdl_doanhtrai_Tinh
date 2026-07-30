import { MigrationInterface, QueryRunner } from 'typeorm';

// Gộp workflow DUYỆT cho KHO TRẠM (storage_locations) — cùng luồng khai báo→gửi
// duyệt→duyệt như doanh trại, để "dữ liệu sạch được chỉ huy xã duyệt" áp dụng cho
// cả kho trạm, không chỉ doanh trại.
//
//   - workflow_status : trạng thái hồ sơ kho (DRAFT→PENDING_REVIEW→APPROVED…).
//   - area_id / organization_id : gắn địa bàn xã + đơn vị để lọc theo phạm vi dữ liệu
//                     giống doanh trại (kho có thể độc lập, không thuộc doanh trại nào).
//   - updated_by     : người cập nhật gần nhất (phục vụ audit + revision).
//   - storage_location_revisions : ảnh chụp bất biến mỗi lần chuyển trạng thái.
//
// Dữ liệu kho ĐÃ CÓ (seed) được coi là hợp lệ → đặt APPROVED để không "ẩn" khỏi cấp Tỉnh.
export class StorageLocationWorkflow1753000016000 implements MigrationInterface {
  name = 'StorageLocationWorkflow1753000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "workflow_status" varchar NOT NULL DEFAULT 'DRAFT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "area_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "organization_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "storage_locations" ADD COLUMN IF NOT EXISTS "updated_by" uuid`,
    );
    // Bản ghi kho có sẵn (seed) coi như đã duyệt hợp lệ.
    await queryRunner.query(
      `UPDATE "storage_locations" SET "workflow_status" = 'APPROVED' WHERE "created_at" < now()`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_storage_locations_area" ON "storage_locations" ("area_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_storage_locations_wf" ON "storage_locations" ("workflow_status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "storage_location_revisions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "storage_location_id" uuid NOT NULL,
        "revision_no" int NOT NULL,
        "payload" jsonb NOT NULL,
        "workflow_status" varchar NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_storage_location_revisions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_storage_location_revision_no" UNIQUE ("storage_location_id", "revision_no")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_slr_location" ON "storage_location_revisions" ("storage_location_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "storage_location_revisions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_storage_locations_wf"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_storage_locations_area"`);
    await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "updated_by"`);
    await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "organization_id"`);
    await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "area_id"`);
    await queryRunner.query(`ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "workflow_status"`);
  }
}
