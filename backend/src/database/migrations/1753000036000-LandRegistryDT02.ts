import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-02 — Hồ sơ Doanh trại (Quyển II §VIII): address_snapshot, land_usage_allocation,
// land_change_event. Reversible. Bổ sung cạnh các bảng đất/nhà/kho đã có.
export class LandRegistryDT021753000036000 implements MigrationInterface {
  name = 'LandRegistryDT021753000036000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE "address_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "owner_type" varchar NOT NULL,
        "owner_id" uuid NOT NULL,
        "province_text" varchar,
        "district_text_legacy" varchar,
        "commune_text" varchar,
        "detail_text" varchar,
        "effective_at" date NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_address_snapshot" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_address_snapshot_owner" ON "address_snapshot" ("owner_type", "owner_id")');

    await queryRunner.query(`
      CREATE TABLE "land_usage_allocation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "land_point_id" uuid NOT NULL,
        "usage_type" varchar NOT NULL DEFAULT 'BUILDING_LAND',
        "area_m2" numeric(18,2) NOT NULL,
        "effective_from" date,
        "effective_to" date,
        "basis_doc_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_land_usage_allocation" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_land_usage_alloc_point" ON "land_usage_allocation" ("land_point_id")');
    await queryRunner.query('CREATE INDEX "IDX_land_usage_alloc_status" ON "land_usage_allocation" ("status")');

    await queryRunner.query(`
      CREATE TABLE "land_change_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "land_point_id" uuid NOT NULL,
        "change_type" varchar NOT NULL,
        "point_delta" int NOT NULL DEFAULT 0,
        "area_delta_m2" numeric(18,2) NOT NULL DEFAULT 0,
        "effective_date" date NOT NULL,
        "reason" text,
        "doc_id" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_land_change_event" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_land_change_point" ON "land_change_event" ("land_point_id")');
    await queryRunner.query('CREATE INDEX "IDX_land_change_date" ON "land_change_event" ("effective_date")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "land_change_event"');
    await queryRunner.query('DROP TABLE IF EXISTS "land_usage_allocation"');
    await queryRunner.query('DROP TABLE IF EXISTS "address_snapshot"');
  }
}
