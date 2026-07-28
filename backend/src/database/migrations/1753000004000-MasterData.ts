import { MigrationInterface, QueryRunner } from 'typeorm';

// M03 — Master Data: danh mục dùng chung (catalogs) + danh mục vật chất (materials).
// Bổ sung vài trường mô tả cho barracks phục vụ màn hồ sơ chi tiết.
export class MasterData1753000004000 implements MigrationInterface {
  name = 'MasterData1753000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "catalogs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" varchar NOT NULL,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" varchar,
        "parent_code" varchar,
        "sort_order" integer NOT NULL DEFAULT 0,
        "version" integer NOT NULL DEFAULT 1,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "effective_from" TIMESTAMPTZ,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_catalogs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_catalogs_type_code" ON "catalogs" ("type", "code")');
    await queryRunner.query('CREATE INDEX "IDX_catalogs_type" ON "catalogs" ("type")');

    await queryRunner.query(`
      CREATE TABLE "materials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "category_code" varchar,
        "unit_code" varchar,
        "spec" varchar,
        "quality_grade" varchar,
        "default_scale" integer NOT NULL DEFAULT 0,
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "version" integer NOT NULL DEFAULT 1,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_materials" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_materials_code" ON "materials" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_materials_category" ON "materials" ("category_code")');

    await queryRunner.query('ALTER TABLE "barracks" ADD COLUMN IF NOT EXISTS "address" varchar');
    await queryRunner.query('ALTER TABLE "barracks" ADD COLUMN IF NOT EXISTS "land_area" numeric(14,2) NOT NULL DEFAULT 0');
    await queryRunner.query(`ALTER TABLE "barracks" ADD COLUMN IF NOT EXISTS "function" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "barracks" DROP COLUMN IF EXISTS "function"');
    await queryRunner.query('ALTER TABLE "barracks" DROP COLUMN IF EXISTS "land_area"');
    await queryRunner.query('ALTER TABLE "barracks" DROP COLUMN IF EXISTS "address"');
    await queryRunner.query('DROP TABLE IF EXISTS "materials"');
    await queryRunner.query('DROP TABLE IF EXISTS "catalogs"');
  }
}
