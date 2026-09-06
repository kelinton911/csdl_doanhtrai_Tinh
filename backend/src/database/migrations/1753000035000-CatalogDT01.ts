import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-01 — Danh mục chuẩn ngành (Quyển I §VIII). 10 bảng, reversible.
// Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at, updated_at, row_version.
export class CatalogDT011753000035000 implements MigrationInterface {
  name = 'CatalogDT011753000035000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    // ---- unit_of_measure ----
    await queryRunner.query(`
      CREATE TABLE "unit_of_measure" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "symbol" varchar,
        "unit_type" varchar NOT NULL DEFAULT 'COUNT',
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abstractCols},
        CONSTRAINT "PK_unit_of_measure" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_unit_of_measure_code" ON "unit_of_measure" ("code")');

    // ---- catalog_version ----
    await queryRunner.query(`
      CREATE TABLE "catalog_version" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "version_code" varchar NOT NULL,
        "version_name" varchar NOT NULL,
        "source_document_id" uuid,
        "issued_by" varchar,
        "effective_from" date,
        "effective_to" date,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "published_at" TIMESTAMPTZ,
        "published_by" uuid,
        ${abstractCols},
        CONSTRAINT "PK_catalog_version" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_catalog_version_code" ON "catalog_version" ("version_code")');
    await queryRunner.query('CREATE INDEX "IDX_catalog_version_status" ON "catalog_version" ("status")');

    // ---- material_catalog ----
    await queryRunner.query(`
      CREATE TABLE "material_catalog" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "version_id" uuid NOT NULL,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "parent_id" uuid,
        "level_no" int NOT NULL DEFAULT 0,
        "unit_id" uuid,
        "is_leaf" boolean NOT NULL DEFAULT true,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "effective_from" date,
        "effective_to" date,
        "source_row_no" int,
        ${abstractCols},
        CONSTRAINT "PK_material_catalog" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_material_catalog_version" ON "material_catalog" ("version_id")');
    await queryRunner.query('CREATE INDEX "IDX_material_catalog_parent" ON "material_catalog" ("parent_id")');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_material_catalog_version_code" ON "material_catalog" ("version_id", "code")',
    );

    // ---- material_alias ----
    await queryRunner.query(`
      CREATE TABLE "material_alias" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_catalog_id" uuid NOT NULL,
        "alias_name" varchar NOT NULL,
        "alias_normalized" varchar NOT NULL,
        "alias_code" varchar,
        "alias_type" varchar NOT NULL DEFAULT 'COMMON',
        "source" varchar,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "verified_by" uuid,
        "verified_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_material_alias" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_material_alias_material" ON "material_alias" ("material_catalog_id")');
    await queryRunner.query('CREATE INDEX "IDX_material_alias_name" ON "material_alias" ("alias_name")');
    await queryRunner.query('CREATE INDEX "IDX_material_alias_norm" ON "material_alias" ("alias_normalized")');

    // ---- catalog_replacement ----
    await queryRunner.query(`
      CREATE TABLE "catalog_replacement" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "old_material_id" uuid NOT NULL,
        "new_material_id" uuid NOT NULL,
        "effective_date" date,
        "reason" varchar,
        "document_id" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_replacement" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_catalog_replacement_old" ON "catalog_replacement" ("old_material_id")');
    await queryRunner.query('CREATE INDEX "IDX_catalog_replacement_new" ON "catalog_replacement" ("new_material_id")');

    // ---- catalog_import_batch ----
    await queryRunner.query(`
      CREATE TABLE "catalog_import_batch" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "file_name" varchar NOT NULL,
        "file_hash" varchar NOT NULL,
        "source_document_id" uuid,
        "version_code" varchar,
        "imported_by" uuid,
        "total_rows" int NOT NULL DEFAULT 0,
        "valid_rows" int NOT NULL DEFAULT 0,
        "error_rows" int NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "rows" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "imported_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_import_batch" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_catalog_import_batch_hash" ON "catalog_import_batch" ("file_hash")');

    // ---- catalog_import_error ----
    await queryRunner.query(`
      CREATE TABLE "catalog_import_error" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_id" uuid NOT NULL,
        "row_no" int NOT NULL,
        "field_name" varchar,
        "error_code" varchar NOT NULL,
        "error_message" varchar NOT NULL,
        "raw_value" varchar,
        CONSTRAINT "PK_catalog_import_error" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_catalog_import_error_batch" ON "catalog_import_error" ("batch_id")');

    // ---- catalog_change_request ----
    await queryRunner.query(`
      CREATE TABLE "catalog_change_request" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_code" varchar NOT NULL,
        "organization_id" uuid,
        "request_type" varchar NOT NULL DEFAULT 'NEW_MATERIAL',
        "proposed_name" varchar NOT NULL,
        "proposed_unit_id" uuid,
        "proposed_parent_id" uuid,
        "description" text,
        "technical_spec" jsonb,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "submitted_by" uuid,
        "submitted_at" TIMESTAMPTZ,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_catalog_change_request" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_catalog_change_request_code" ON "catalog_change_request" ("request_code")',
    );
    await queryRunner.query('CREATE INDEX "IDX_catalog_change_request_org" ON "catalog_change_request" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_catalog_change_request_status" ON "catalog_change_request" ("status")');

    // ---- temporary_material ----
    await queryRunner.query(`
      CREATE TABLE "temporary_material" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "temporary_code" varchar NOT NULL,
        "request_id" uuid,
        "display_name" varchar NOT NULL,
        "unit_id" uuid,
        "proposed_parent_id" uuid,
        "status" varchar NOT NULL DEFAULT 'PENDING_MAPPING',
        "official_material_id" uuid,
        "mapped_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_temporary_material" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_temporary_material_code" ON "temporary_material" ("temporary_code")',
    );
    await queryRunner.query('CREATE INDEX "IDX_temporary_material_status" ON "temporary_material" ("status")');

    // ---- catalog_model_link ----
    await queryRunner.query(`
      CREATE TABLE "catalog_model_link" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_catalog_id" uuid NOT NULL,
        "product_model_id" uuid NOT NULL,
        "effective_from" date,
        "effective_to" date,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_catalog_model_link" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_catalog_model_link_material" ON "catalog_model_link" ("material_catalog_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "catalog_model_link"');
    await queryRunner.query('DROP TABLE IF EXISTS "temporary_material"');
    await queryRunner.query('DROP TABLE IF EXISTS "catalog_change_request"');
    await queryRunner.query('DROP TABLE IF EXISTS "catalog_import_error"');
    await queryRunner.query('DROP TABLE IF EXISTS "catalog_import_batch"');
    await queryRunner.query('DROP TABLE IF EXISTS "catalog_replacement"');
    await queryRunner.query('DROP TABLE IF EXISTS "material_alias"');
    await queryRunner.query('DROP TABLE IF EXISTS "material_catalog"');
    await queryRunner.query('DROP TABLE IF EXISTS "catalog_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "unit_of_measure"');
  }
}
