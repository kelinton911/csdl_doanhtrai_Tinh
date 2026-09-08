import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-11 — Report Engine (Quyển XI §VIII). 11 bảng, reversible. Biểu CẤU HÌNH (report_definition +
// report_template_version); dataset từ snapshot chuẩn (dataset_definition/field/filter/formula +
// dataset_instance có dataset_hash + source_fingerprint) → validate (dataset_validation) → report_instance
// (workflow ISSUED, file checksum bất biến) → report_rollup (chống aggregate trùng) → report_lineage (truy vết ô).
// Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at, updated_at, row_version.
export class ReportEngineDT111753000045000 implements MigrationInterface {
  name = 'ReportEngineDT111753000045000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    // ---- report_definition ----
    await queryRunner.query(`
      CREATE TABLE "report_definition" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "form_code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "category" varchar,
        "description" text,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "current_version_no" int NOT NULL DEFAULT 0,
        ${abstractCols},
        CONSTRAINT "PK_report_definition" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_report_definition_form_code" ON "report_definition" ("form_code")');
    await queryRunner.query('CREATE INDEX "IDX_report_definition_status" ON "report_definition" ("status")');

    // ---- report_template_version ----
    await queryRunner.query(`
      CREATE TABLE "report_template_version" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_definition_id" uuid NOT NULL,
        "version_no" int NOT NULL,
        "layout_schema_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "effective_from" TIMESTAMPTZ,
        "effective_to" TIMESTAMPTZ,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        ${abstractCols},
        CONSTRAINT "PK_report_template_version" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_rtv_definition" ON "report_template_version" ("report_definition_id")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_rtv_def_version" ON "report_template_version" ("report_definition_id", "version_no")');

    // ---- dataset_definition ----
    await queryRunner.query(`
      CREATE TABLE "dataset_definition" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "source_type" varchar NOT NULL,
        "unit_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abstractCols},
        CONSTRAINT "PK_dataset_definition" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dataset_definition_code" ON "dataset_definition" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_dataset_definition_source" ON "dataset_definition" ("source_type")');

    // ---- dataset_field ----
    await queryRunner.query(`
      CREATE TABLE "dataset_field" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dataset_definition_id" uuid NOT NULL,
        "field_key" varchar NOT NULL,
        "source_path" varchar NOT NULL,
        "header" varchar,
        "data_type" varchar NOT NULL DEFAULT 'string',
        "order_no" int NOT NULL DEFAULT 0,
        ${abstractCols},
        CONSTRAINT "PK_dataset_field" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_dataset_field_def" ON "dataset_field" ("dataset_definition_id")');

    // ---- dataset_filter ----
    await queryRunner.query(`
      CREATE TABLE "dataset_filter" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dataset_definition_id" uuid NOT NULL,
        "filter_key" varchar NOT NULL,
        "expr" text NOT NULL,
        "order_no" int NOT NULL DEFAULT 0,
        ${abstractCols},
        CONSTRAINT "PK_dataset_filter" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_dataset_filter_def" ON "dataset_filter" ("dataset_definition_id")');

    // ---- dataset_formula ----
    await queryRunner.query(`
      CREATE TABLE "dataset_formula" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dataset_definition_id" uuid NOT NULL,
        "target_field" varchar NOT NULL,
        "formula_expr" text NOT NULL,
        "order_no" int NOT NULL DEFAULT 0,
        ${abstractCols},
        CONSTRAINT "PK_dataset_formula" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_dataset_formula_def" ON "dataset_formula" ("dataset_definition_id")');

    // ---- dataset_instance ----
    await queryRunner.query(`
      CREATE TABLE "dataset_instance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dataset_definition_id" uuid NOT NULL,
        "source_snapshot_ref" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "dataset_hash" varchar NOT NULL,
        "source_fingerprint" varchar NOT NULL,
        "generated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "status" varchar NOT NULL DEFAULT 'GENERATED',
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "payload_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "row_count" int NOT NULL DEFAULT 0,
        ${abstractCols},
        CONSTRAINT "PK_dataset_instance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_dataset_instance_def" ON "dataset_instance" ("dataset_definition_id")');
    await queryRunner.query('CREATE INDEX "IDX_dataset_instance_hash" ON "dataset_instance" ("dataset_hash")');

    // ---- dataset_validation ----
    await queryRunner.query(`
      CREATE TABLE "dataset_validation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "dataset_instance_id" uuid NOT NULL,
        "check_type" varchar NOT NULL,
        "status" varchar NOT NULL,
        "message" text,
        "details_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ${abstractCols},
        CONSTRAINT "PK_dataset_validation" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_dataset_validation_instance" ON "dataset_validation" ("dataset_instance_id")');

    // ---- report_instance ----
    await queryRunner.query(`
      CREATE TABLE "report_instance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_code" varchar NOT NULL,
        "report_definition_id" uuid NOT NULL,
        "template_version_id" uuid NOT NULL,
        "dataset_instance_id" uuid NOT NULL,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "version_no" int NOT NULL DEFAULT 1,
        "superseded_by_id" uuid,
        "file_object_key" varchar,
        "file_format" varchar,
        "checksum" varchar,
        "approved_at" TIMESTAMPTZ,
        "issued_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_report_instance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_report_instance_code" ON "report_instance" ("report_code")');
    await queryRunner.query('CREATE INDEX "IDX_report_instance_definition" ON "report_instance" ("report_definition_id")');
    await queryRunner.query('CREATE INDEX "IDX_report_instance_status" ON "report_instance" ("status")');

    // ---- report_rollup ----
    await queryRunner.query(`
      CREATE TABLE "report_rollup" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "parent_report_id" uuid NOT NULL,
        "child_org_id" uuid NOT NULL,
        "child_org_name" varchar,
        "child_instance_id" uuid,
        "submission_status" varchar NOT NULL DEFAULT 'MISSING',
        "aggregated" boolean NOT NULL DEFAULT false,
        "aggregated_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_report_rollup" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_rollup_parent" ON "report_rollup" ("parent_report_id")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_rollup_parent_child" ON "report_rollup" ("parent_report_id", "child_org_id")');

    // ---- report_lineage ----
    await queryRunner.query(`
      CREATE TABLE "report_lineage" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "report_instance_id" uuid NOT NULL,
        "cell_ref" varchar NOT NULL,
        "dataset_field" varchar,
        "cell_state" varchar NOT NULL DEFAULT 'VALUE',
        "value" numeric(18,4),
        "snapshot_ref" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "transaction_ref" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_lineage" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_lineage_report" ON "report_lineage" ("report_instance_id")');
    await queryRunner.query('CREATE INDEX "IDX_lineage_report_cell" ON "report_lineage" ("report_instance_id", "cell_ref")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "report_lineage"');
    await queryRunner.query('DROP TABLE IF EXISTS "report_rollup"');
    await queryRunner.query('DROP TABLE IF EXISTS "report_instance"');
    await queryRunner.query('DROP TABLE IF EXISTS "dataset_validation"');
    await queryRunner.query('DROP TABLE IF EXISTS "dataset_instance"');
    await queryRunner.query('DROP TABLE IF EXISTS "dataset_formula"');
    await queryRunner.query('DROP TABLE IF EXISTS "dataset_filter"');
    await queryRunner.query('DROP TABLE IF EXISTS "dataset_field"');
    await queryRunner.query('DROP TABLE IF EXISTS "dataset_definition"');
    await queryRunner.query('DROP TABLE IF EXISTS "report_template_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "report_definition"');
  }
}
