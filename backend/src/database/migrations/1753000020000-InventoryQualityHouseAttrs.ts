import { MigrationInterface, QueryRunner } from 'typeorm';

// Bổ sung schema đáp ứng bộ biểu kiểm kê thật (Hải Phòng 2026): phân cấp chất lượng Cấp 1–5,
// đơn giá/giá trị (1000đ), mục đích dự trữ (6 loại KKDT), thuộc tính nhà (02/KK-NHA),
// biến động theo kỳ kiểm kê. Xem ADR-2026-08-01-inventory-quality-house-schema.md.
//
// Nguyên tắc: THUẦN CỘNG THÊM, tương thích ngược. Không sửa stock_balances lõi, không đổi
// unique index / logic upsert của inventory.service. Tham chiếu MỀM (reserve_purpose,
// location_class, campaign_id) — không FK cứng, đúng quy ước sẵn có của dự án.
export class InventoryQualityHouseAttrs1753000020000
  implements MigrationInterface
{
  name = 'InventoryQualityHouseAttrs1753000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Đơn giá/giá trị trên danh mục vật chất (gap 2). Đơn vị mặc định 1000đ theo biểu KK.
    await queryRunner.query(`
      ALTER TABLE "materials"
        ADD COLUMN IF NOT EXISTS "unit_price" numeric(18,3),
        ADD COLUMN IF NOT EXISTS "price_currency" varchar NOT NULL DEFAULT 'VND_1000',
        ADD COLUMN IF NOT EXISTS "price_effective_from" date,
        ADD COLUMN IF NOT EXISTS "price_note" varchar
    `);

    // 2) Chi tiết kiểm kê: phân cấp chất lượng Cấp 1–5 × mục đích dự trữ × vị trí (gap 1+3).
    // Tách khỏi stock_balances để không ảnh hưởng tồn kho đang chạy.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_quality_details" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_id" uuid NOT NULL,
        "storage_location_id" uuid NOT NULL,
        "reserve_purpose" varchar NOT NULL DEFAULT 'THUONG_XUYEN',
        "location_class" varchar NOT NULL DEFAULT 'DANG_SU_DUNG',
        "qty_grade_1" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_2" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_3" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_4" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_5" numeric(18,3) NOT NULL DEFAULT 0,
        "unit_price" numeric(18,3),
        "note" varchar,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_stock_quality_details" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_sqd_mat_loc_purpose_class"
       ON "stock_quality_details" ("material_id", "storage_location_id", "reserve_purpose", "location_class")`,
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_sqd_material" ON "stock_quality_details" ("material_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_sqd_purpose" ON "stock_quality_details" ("reserve_purpose")',
    );

    // 3) Biến động theo kỳ kiểm kê (gap 5). campaign_id tham chiếu MỀM inspection_campaigns.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_period_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "material_id" uuid NOT NULL,
        "storage_location_id" uuid,
        "reserve_purpose" varchar NOT NULL DEFAULT 'THUONG_XUYEN',
        "opening_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "increase_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "decrease_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "closing_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "opening_value" numeric(18,3),
        "closing_value" numeric(18,3),
        "note" varchar,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_period_snapshots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ips_campaign_mat_loc_purpose"
       ON "inventory_period_snapshots" ("campaign_id", "material_id", "storage_location_id", "reserve_purpose")`,
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_ips_campaign" ON "inventory_period_snapshots" ("campaign_id")',
    );

    // 4) Thuộc tính nhà chi tiết theo 02/KK-NHA (gap 4). Cột phụ, cho phép NULL.
    await queryRunner.query(`
      ALTER TABLE "facilities"
        ADD COLUMN IF NOT EXISTS "house_class" varchar,
        ADD COLUMN IF NOT EXISTS "floors" int,
        ADD COLUMN IF NOT EXISTS "floor_area" numeric(12,2),
        ADD COLUMN IF NOT EXISTS "use_area" numeric(12,2),
        ADD COLUMN IF NOT EXISTS "usage_nature" varchar,
        ADD COLUMN IF NOT EXISTS "lightning_protection" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "structure" jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "utilities" jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "repair_need" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "facilities"
        DROP COLUMN IF EXISTS "repair_need",
        DROP COLUMN IF EXISTS "utilities",
        DROP COLUMN IF EXISTS "structure",
        DROP COLUMN IF EXISTS "lightning_protection",
        DROP COLUMN IF EXISTS "usage_nature",
        DROP COLUMN IF EXISTS "use_area",
        DROP COLUMN IF EXISTS "floor_area",
        DROP COLUMN IF EXISTS "floors",
        DROP COLUMN IF EXISTS "house_class"
    `);
    await queryRunner.query('DROP TABLE IF EXISTS "inventory_period_snapshots"');
    await queryRunner.query('DROP TABLE IF EXISTS "stock_quality_details"');
    await queryRunner.query(`
      ALTER TABLE "materials"
        DROP COLUMN IF EXISTS "price_note",
        DROP COLUMN IF EXISTS "price_effective_from",
        DROP COLUMN IF EXISTS "price_currency",
        DROP COLUMN IF EXISTS "unit_price"
    `);
  }
}
