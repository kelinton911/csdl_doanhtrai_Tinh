import { MigrationInterface, QueryRunner } from 'typeorm';

// M16 — Nguồn lực huy động tại địa phương (cơ sở/máy móc/vật liệu/nhà thầu có thể huy động).
export class LocalResources1753000021000 implements MigrationInterface {
  name = 'LocalResources1753000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "local_resources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar NOT NULL,
        "resource_type" varchar NOT NULL,
        "owner_name" varchar,
        "owner_type" varchar,
        "contact_name" varchar,
        "contact_phone" varchar,
        "area_id" uuid,
        "address" varchar,
        "location" geometry(Point, 4326),
        "capacity_desc" varchar,
        "capacity_qty" numeric(14,2) NOT NULL DEFAULT 0,
        "capacity_unit" varchar,
        "mobilization_time" varchar NOT NULL DEFAULT 'MEDIUM',
        "reliability" varchar NOT NULL DEFAULT 'MEDIUM',
        "agreement_no" varchar,
        "agreement_valid_until" date,
        "agreement_status" varchar NOT NULL DEFAULT 'NONE',
        "surveyed_at" date,
        "survey_note" text,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_local_resources" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_local_resource_code" ON "local_resources" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_local_resource_category" ON "local_resources" ("category")');
    await queryRunner.query('CREATE INDEX "IDX_local_resource_status" ON "local_resources" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_local_resource_geom" ON "local_resources" USING GIST ("location")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "local_resources"');
  }
}
