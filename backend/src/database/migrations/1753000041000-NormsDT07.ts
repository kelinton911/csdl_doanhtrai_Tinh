import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-07 — Định mức có căn cứ + bộ chọn deterministic + Chỉ lệnh hậu cần (Quyển VII §VIII/§X/§XV).
// 17 bảng, reversible. Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at,
// updated_at, row_version.
export class NormsDT071753000041000 implements MigrationInterface {
  name = 'NormsDT071753000041000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    // ---- normative_document ----
    await queryRunner.query(`
      CREATE TABLE "normative_document" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "doc_no" varchar NOT NULL,
        "title" varchar NOT NULL,
        "issuing_authority" varchar NOT NULL,
        "issue_date" date,
        ${abstractCols},
        CONSTRAINT "PK_normative_document" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_normative_document_doc_no" ON "normative_document" ("doc_no")');

    // ---- normative_document_version ----
    await queryRunner.query(`
      CREATE TABLE "normative_document_version" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "version_label" varchar NOT NULL,
        "file_id" uuid,
        "file_hash" varchar,
        "effective_from" date,
        "effective_to" date,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        ${abstractCols},
        CONSTRAINT "PK_normative_document_version" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_ndv_document" ON "normative_document_version" ("document_id")');
    await queryRunner.query('CREATE INDEX "IDX_ndv_hash" ON "normative_document_version" ("file_hash")');
    await queryRunner.query('CREATE INDEX "IDX_ndv_status" ON "normative_document_version" ("status")');

    // ---- norm_source_reference ----
    await queryRunner.query(`
      CREATE TABLE "norm_source_reference" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_version_id" uuid NOT NULL,
        "page_no" int,
        "line_ref" varchar,
        "quote_text" text,
        "appendix_code" varchar,
        ${abstractCols},
        CONSTRAINT "PK_norm_source_reference" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_nsr_docver" ON "norm_source_reference" ("document_version_id")');

    // ---- norm_set ----
    await queryRunner.query(`
      CREATE TABLE "norm_set" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "set_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        ${abstractCols},
        CONSTRAINT "PK_norm_set" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_norm_set_code" ON "norm_set" ("set_code")');

    // ---- norm_set_version ----
    await queryRunner.query(`
      CREATE TABLE "norm_set_version" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "norm_set_id" uuid NOT NULL,
        "version_label" varchar NOT NULL,
        "document_version_id" uuid,
        "effective_from" date,
        "effective_to" date,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "published_at" TIMESTAMPTZ,
        "published_by" uuid,
        ${abstractCols},
        CONSTRAINT "PK_norm_set_version" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_nsv_set" ON "norm_set_version" ("norm_set_id")');
    await queryRunner.query('CREATE INDEX "IDX_nsv_status" ON "norm_set_version" ("status")');

    // ---- material_norm ----
    await queryRunner.query(`
      CREATE TABLE "material_norm" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "norm_set_version_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "semantic_param" varchar NOT NULL,
        "value_type" varchar NOT NULL DEFAULT 'FIXED',
        "value_numeric" numeric(18,4),
        "raw_value" varchar,
        "unit_id" uuid,
        "formula_expr" text,
        "source_status" varchar NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
        "source_reference_id" uuid,
        "effective_from" date,
        "effective_to" date,
        "import_batch_id" uuid,
        ${abstractCols},
        CONSTRAINT "PK_material_norm" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_material_norm_setver" ON "material_norm" ("norm_set_version_id")');
    await queryRunner.query('CREATE INDEX "IDX_material_norm_material" ON "material_norm" ("material_catalog_id")');
    await queryRunner.query('CREATE INDEX "IDX_material_norm_source_status" ON "material_norm" ("source_status")');
    await queryRunner.query(
      'CREATE INDEX "IDX_material_norm_lookup" ON "material_norm" ("material_catalog_id", "semantic_param")',
    );

    // ---- norm_dimension ----
    await queryRunner.query(`
      CREATE TABLE "norm_dimension" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_norm_id" uuid NOT NULL,
        "dimension_type" varchar NOT NULL,
        "dimension_value" varchar NOT NULL,
        ${abstractCols},
        CONSTRAINT "PK_norm_dimension" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_norm_dimension_norm" ON "norm_dimension" ("material_norm_id")');

    // ---- calculation_parameter ----
    await queryRunner.query(`
      CREATE TABLE "calculation_parameter" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "semantic_param" varchar NOT NULL,
        "description" varchar NOT NULL,
        "unit_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abstractCols},
        CONSTRAINT "PK_calculation_parameter" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_calc_param_semantic" ON "calculation_parameter" ("semantic_param")');

    // ---- norm_selector_config ----
    await queryRunner.query(`
      CREATE TABLE "norm_selector_config" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "config_code" varchar NOT NULL,
        "strategy" varchar NOT NULL DEFAULT 'MOST_SPECIFIC',
        "tie_break_order" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abstractCols},
        CONSTRAINT "PK_norm_selector_config" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_norm_selector_config_code" ON "norm_selector_config" ("config_code")');

    // ---- authority_rank_version ----
    await queryRunner.query(`
      CREATE TABLE "authority_rank_version" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "version_label" varchar NOT NULL,
        "rank_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "effective_from" date,
        "is_active" boolean NOT NULL DEFAULT false,
        ${abstractCols},
        CONSTRAINT "PK_authority_rank_version" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_authority_rank_label" ON "authority_rank_version" ("version_label")');
    await queryRunner.query('CREATE INDEX "IDX_authority_rank_active" ON "authority_rank_version" ("is_active")');

    // ---- norm_conflict_case ----
    await queryRunner.query(`
      CREATE TABLE "norm_conflict_case" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resolve_request_hash" varchar NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "semantic_param" varchar NOT NULL,
        "candidate_norm_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "request_scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "resolution_note" text,
        "resolved_norm_id" uuid,
        "resolved_by" uuid,
        "resolved_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_norm_conflict_case" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_conflict_hash" ON "norm_conflict_case" ("resolve_request_hash")');
    await queryRunner.query('CREATE INDEX "IDX_conflict_status" ON "norm_conflict_case" ("status")');

    // ---- norm_import_batch ----
    await queryRunner.query(`
      CREATE TABLE "norm_import_batch" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "file_name" varchar NOT NULL,
        "file_hash" varchar NOT NULL,
        "norm_set_version_id" uuid,
        "imported_by" uuid,
        "total_rows" int NOT NULL DEFAULT 0,
        "valid_rows" int NOT NULL DEFAULT 0,
        "error_rows" int NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "rows" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "imported_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_norm_import_batch" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_norm_import_hash" ON "norm_import_batch" ("file_hash")');

    // ---- command ----
    await queryRunner.query(`
      CREATE TABLE "command" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "command_no" varchar NOT NULL,
        "title" varchar NOT NULL,
        "issuing_authority" varchar NOT NULL,
        "effective_date" date,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "issued_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_command" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_command_no" ON "command" ("command_no")');
    await queryRunner.query('CREATE INDEX "IDX_command_status" ON "command" ("status")');

    // ---- command_version ----
    await queryRunner.query(`
      CREATE TABLE "command_version" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "command_id" uuid NOT NULL,
        "version_label" varchar NOT NULL,
        "file_id" uuid,
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_command_version" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_command_version_cmd" ON "command_version" ("command_id")');

    // ---- command_requirement ----
    await queryRunner.query(`
      CREATE TABLE "command_requirement" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "command_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "required_qty" numeric(18,3) NOT NULL,
        "unit_id" uuid,
        "deadline" date,
        "norm_set_version_id" uuid,
        "material_norm_id" uuid,
        ${abstractCols},
        CONSTRAINT "PK_command_requirement" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_command_req_cmd" ON "command_requirement" ("command_id")');

    // ---- command_assignment ----
    await queryRunner.query(`
      CREATE TABLE "command_assignment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "requirement_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "allocated_qty" numeric(18,3) NOT NULL,
        "deadline" date,
        ${abstractCols},
        CONSTRAINT "PK_command_assignment" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_command_assign_req" ON "command_assignment" ("requirement_id")');

    // ---- command_progress ----
    await queryRunner.query(`
      CREATE TABLE "command_progress" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "assignment_id" uuid NOT NULL,
        "reported_qty" numeric(18,3) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'REPORTED',
        "reported_at" TIMESTAMPTZ,
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_command_progress" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_command_progress_assign" ON "command_progress" ("assignment_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "command_progress"');
    await queryRunner.query('DROP TABLE IF EXISTS "command_assignment"');
    await queryRunner.query('DROP TABLE IF EXISTS "command_requirement"');
    await queryRunner.query('DROP TABLE IF EXISTS "command_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "command"');
    await queryRunner.query('DROP TABLE IF EXISTS "norm_import_batch"');
    await queryRunner.query('DROP TABLE IF EXISTS "norm_conflict_case"');
    await queryRunner.query('DROP TABLE IF EXISTS "authority_rank_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "norm_selector_config"');
    await queryRunner.query('DROP TABLE IF EXISTS "calculation_parameter"');
    await queryRunner.query('DROP TABLE IF EXISTS "norm_dimension"');
    await queryRunner.query('DROP TABLE IF EXISTS "material_norm"');
    await queryRunner.query('DROP TABLE IF EXISTS "norm_set_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "norm_set"');
    await queryRunner.query('DROP TABLE IF EXISTS "norm_source_reference"');
    await queryRunner.query('DROP TABLE IF EXISTS "normative_document_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "normative_document"');
  }
}
