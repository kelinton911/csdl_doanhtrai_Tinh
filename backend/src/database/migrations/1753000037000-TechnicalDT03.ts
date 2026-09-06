import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-03 — Hồ sơ kỹ thuật vật chất (Quyển III §VIII). 10 bảng, reversible.
export class TechnicalDT031753000037000 implements MigrationInterface {
  name = 'TechnicalDT031753000037000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const abs = `
      "created_by" uuid, "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    await queryRunner.query(`
      CREATE TABLE "product_model" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "model_code_internal" varchar NOT NULL,
        "model_name" varchar NOT NULL,
        "short_name" varchar,
        "design_symbol" varchar,
        "design_year" varchar,
        "issuing_authority" varchar,
        "technology_group" varchar,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        ${abs},
        CONSTRAINT "PK_product_model" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_product_model_code" ON "product_model" ("model_code_internal")');
    await queryRunner.query('CREATE INDEX "IDX_product_model_symbol" ON "product_model" ("design_symbol")');

    await queryRunner.query(`
      CREATE TABLE "model_catalog_link" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "product_model_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "link_type" varchar NOT NULL DEFAULT 'PRIMARY',
        "effective_from" date, "effective_to" date,
        "basis_document_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_model_catalog_link" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_mcl_model" ON "model_catalog_link" ("product_model_id")');
    await queryRunner.query('CREATE INDEX "IDX_mcl_catalog" ON "model_catalog_link" ("material_catalog_id")');

    await queryRunner.query(`
      CREATE TABLE "design_revision" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "product_model_id" uuid NOT NULL,
        "revision_code" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "effective_from" date, "effective_to" date,
        "supersedes_revision_id" uuid,
        "change_summary" text,
        "published_at" TIMESTAMPTZ,
        ${abs},
        CONSTRAINT "PK_design_revision" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_revision_model" ON "design_revision" ("product_model_id")');
    await queryRunner.query('CREATE INDEX "IDX_revision_status" ON "design_revision" ("status")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_design_revision_model_code" ON "design_revision" ("product_model_id", "revision_code")');

    await queryRunner.query(`
      CREATE TABLE "technical_document" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "revision_id" uuid NOT NULL,
        "document_type" varchar NOT NULL DEFAULT 'DRAWING_SET',
        "title" varchar NOT NULL,
        "file_id" uuid, "file_hash" varchar,
        "source_name" varchar, "issue_date" date,
        "total_sheets" int NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_technical_document" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_techdoc_revision" ON "technical_document" ("revision_id")');
    await queryRunner.query('CREATE INDEX "IDX_techdoc_hash" ON "technical_document" ("file_hash")');

    await queryRunner.query(`
      CREATE TABLE "drawing_sheet" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "technical_document_id" uuid NOT NULL,
        "sheet_no" varchar NOT NULL,
        "sheet_title" varchar, "sheet_type" varchar, "scale_text" varchar,
        "source_page" int, "preview_file_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_drawing_sheet" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_sheet_doc" ON "drawing_sheet" ("technical_document_id")');

    await queryRunner.query(`
      CREATE TABLE "technical_attribute" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "revision_id" uuid NOT NULL,
        "attr_name" varchar NOT NULL,
        "value_numeric" numeric(18,4),
        "raw_value" varchar, "raw_unit" varchar, "unit_id" uuid,
        "verification_status" varchar NOT NULL DEFAULT 'DRAFT_EXTRACTED',
        "source_sheet_id" uuid,
        ${abs},
        CONSTRAINT "PK_technical_attribute" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_attr_revision" ON "technical_attribute" ("revision_id")');
    await queryRunner.query('CREATE INDEX "IDX_attr_verif" ON "technical_attribute" ("verification_status")');

    await queryRunner.query(`
      CREATE TABLE "bom_header" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "revision_id" uuid NOT NULL,
        "name" varchar, "note" text,
        ${abs},
        CONSTRAINT "PK_bom_header" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_bom_header_revision" ON "bom_header" ("revision_id")');

    await queryRunner.query(`
      CREATE TABLE "bom_item" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bom_header_id" uuid NOT NULL,
        "line_no" int NOT NULL DEFAULT 0,
        "group_name" varchar, "component_id" uuid,
        "raw_name" varchar NOT NULL, "unit_id" uuid,
        "quantity" numeric(18,3),
        "length_mm" numeric(12,2), "width_mm" numeric(12,2), "thickness_mm" numeric(12,2),
        "status" varchar NOT NULL DEFAULT 'UNMAPPED',
        ${abs},
        CONSTRAINT "PK_bom_item" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_bom_item_header" ON "bom_item" ("bom_header_id")');
    await queryRunner.query('CREATE INDEX "IDX_bom_item_status" ON "bom_item" ("status")');

    await queryRunner.query(`
      CREATE TABLE "source_provenance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entity_type" varchar NOT NULL, "entity_id" uuid NOT NULL,
        "source_file" varchar, "source_page" int,
        "extraction_method" varchar, "confidence_level" numeric(5,2),
        "verification_status" varchar NOT NULL DEFAULT 'DRAFT_EXTRACTED',
        "verified_by" uuid, "verified_at" TIMESTAMPTZ,
        "created_by" uuid, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_source_provenance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_prov_entity" ON "source_provenance" ("entity_type", "entity_id")');

    await queryRunner.query(`
      CREATE TABLE "model_relationship" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_model_id" uuid NOT NULL, "target_model_id" uuid NOT NULL,
        "relationship_type" varchar NOT NULL,
        "basis_document_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_model_relationship" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_rel_source" ON "model_relationship" ("source_model_id")');
    await queryRunner.query('CREATE INDEX "IDX_rel_target" ON "model_relationship" ("target_model_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of [
      'model_relationship', 'source_provenance', 'bom_item', 'bom_header',
      'technical_attribute', 'drawing_sheet', 'technical_document',
      'design_revision', 'model_catalog_link', 'product_model',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
