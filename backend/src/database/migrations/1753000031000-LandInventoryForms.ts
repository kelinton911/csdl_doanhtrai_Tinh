import { MigrationInterface, QueryRunner } from 'typeorm';

// Bộ 5 biểu BCQK Đất Quốc phòng (nộp QK3): mở rộng land_parcels + 3 bảng mới.
// - land_parcels: bóc tách hiện trạng (QP/kinh tế/khu GĐ), serie+ngày GCN, số điểm, hồ sơ pháp lý.
// - land_economic_use: đất QP cho thuê/mượn/LDLK (biểu 04/KK-ĐQP) — nhiều hợp đồng/thửa.
// - family_housing_areas: khu gia đình đang QL, chưa bàn giao (biểu 01/KK-KGĐ).
// - land_period_snapshots: chốt số liệu theo kỳ kiểm kê để dựng cột kỳ trước/tăng/giảm/kỳ này.
export class LandInventoryForms1753000031000 implements MigrationInterface {
  name = 'LandInventoryForms1753000031000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A1 — bổ sung cột cho land_parcels (biểu 01/02/03).
    await queryRunner.query(`
      ALTER TABLE "land_parcels"
        ADD COLUMN IF NOT EXISTS "point_count" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "certificate_serie" varchar,
        ADD COLUMN IF NOT EXISTS "certificate_issued_at" date,
        ADD COLUMN IF NOT EXISTS "area_defense" numeric(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "area_economic" numeric(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "area_family" numeric(14,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "family_has_bqp_approval" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "legal_docs" text,
        ADD COLUMN IF NOT EXISTS "data_source" varchar
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_land_parcels_data_source" ON "land_parcels" ("data_source")',
    );

    // A2 — đất QP cho thuê/mượn/LDLK (biểu 04/KK-ĐQP).
    await queryRunner.query(`
      CREATE TABLE "land_economic_use" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "land_parcel_id" uuid NOT NULL,
        "area" numeric(14,2) NOT NULL DEFAULT 0,
        "legal_basis" varchar NOT NULL DEFAULT 'TU_KY',
        "bqp_status" varchar NOT NULL DEFAULT 'KHONG',
        "contract_no" varchar,
        "certificate_serie" varchar,
        "note" text,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_land_economic_use" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_land_econ_parcel" ON "land_economic_use" ("land_parcel_id")',
    );
    await queryRunner.query(
      'ALTER TABLE "land_economic_use" ADD CONSTRAINT "FK_land_econ_parcel" ' +
        'FOREIGN KEY ("land_parcel_id") REFERENCES "land_parcels"("id") ON DELETE CASCADE',
    );

    // A3 — khu gia đình quân đội đang QL, chưa bàn giao (biểu 01/KK-KGĐ).
    await queryRunner.query(`
      CREATE TABLE "family_housing_areas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "organization_id" uuid,
        "area_id" uuid,
        "address" varchar,
        "total_area" numeric(14,2) NOT NULL DEFAULT 0,
        "household_count" integer NOT NULL DEFAULT 0,
        "legal_doc" text,
        "not_handed_reason" text,
        "planned_handover" varchar,
        "note" text,
        "data_source" varchar,
        "workflow_status" varchar NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_family_housing_areas" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_family_housing_code" ON "family_housing_areas" ("code")',
    );

    // A4 — chốt số liệu theo kỳ kiểm kê (per-parcel) để dựng cột kỳ trước/tăng/giảm/kỳ này.
    await queryRunner.query(`
      CREATE TABLE "land_period_snapshots" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "period_date" date NOT NULL,
        "land_parcel_id" uuid,
        "parcel_code" varchar NOT NULL,
        "organization_id" uuid,
        "point_count" integer NOT NULL DEFAULT 1,
        "area" numeric(14,2) NOT NULL DEFAULT 0,
        "area_defense" numeric(14,2) NOT NULL DEFAULT 0,
        "area_economic" numeric(14,2) NOT NULL DEFAULT 0,
        "area_family" numeric(14,2) NOT NULL DEFAULT 0,
        "cert_count" integer NOT NULL DEFAULT 0,
        "cert_area" numeric(14,2) NOT NULL DEFAULT 0,
        "note" varchar,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_land_period_snapshots" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_land_snapshot_period_code" ON "land_period_snapshots" ("period_date", "parcel_code")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_land_snapshot_period" ON "land_period_snapshots" ("period_date")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "land_period_snapshots"');
    await queryRunner.query('DROP TABLE IF EXISTS "family_housing_areas"');
    await queryRunner.query('DROP TABLE IF EXISTS "land_economic_use"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_land_parcels_data_source"');
    await queryRunner.query(`
      ALTER TABLE "land_parcels"
        DROP COLUMN IF EXISTS "point_count",
        DROP COLUMN IF EXISTS "certificate_serie",
        DROP COLUMN IF EXISTS "certificate_issued_at",
        DROP COLUMN IF EXISTS "area_defense",
        DROP COLUMN IF EXISTS "area_economic",
        DROP COLUMN IF EXISTS "area_family",
        DROP COLUMN IF EXISTS "family_has_bqp_approval",
        DROP COLUMN IF EXISTS "legal_docs",
        DROP COLUMN IF EXISTS "data_source"
    `);
  }
}
