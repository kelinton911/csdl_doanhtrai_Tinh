import { MigrationInterface, QueryRunner } from 'typeorm';

// Feature 02 — Dòng VẬT CHẤT tiềm lực HC-KT địa phương (KVPT) trong bản khai tiềm lực cấp xã.
// Chọn theo material_catalog; catalogGroup phân biệt danh mục chuẩn vs tiềm lực địa phương.
export class CommunePotentialMaterial1753000054000 implements MigrationInterface {
  name = 'CommunePotentialMaterial1753000054000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "commune_potential_materials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "commune_potential_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "alias_used" varchar,
        "unit_id" uuid,
        "catalog_group" varchar NOT NULL DEFAULT 'STANDARD',
        "quantity" numeric(18,3) NOT NULL DEFAULT 0,
        "note" text,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_commune_potential_materials" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_cpm_potential" ON "commune_potential_materials" ("commune_potential_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_cpm_catalog" ON "commune_potential_materials" ("material_catalog_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "commune_potential_materials"');
  }
}
