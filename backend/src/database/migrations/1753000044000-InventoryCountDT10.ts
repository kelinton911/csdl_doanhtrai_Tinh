import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-10 — Kiểm kê & chốt số liệu (Quyển X §VIII). 13 bảng, reversible. Ba lớp độc lập
// Book (book_snapshot) / Physical (count_sheet) / Official (official_snapshot). Blind count,
// recount vòng mới (không ghi đè), official khóa bất biến, điều chỉnh → DT-05.
// Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at, updated_at, row_version.
export class InventoryCountDT101753000044000 implements MigrationInterface {
  name = 'InventoryCountDT101753000044000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;
    const g5 = `
      "grade1" numeric(18,3) NOT NULL DEFAULT 0,
      "grade2" numeric(18,3) NOT NULL DEFAULT 0,
      "grade3" numeric(18,3) NOT NULL DEFAULT 0,
      "grade4" numeric(18,3) NOT NULL DEFAULT 0,
      "grade5" numeric(18,3) NOT NULL DEFAULT 0
    `;

    // ---- inventory_count_campaign ----
    await queryRunner.query(`
      CREATE TABLE "inventory_count_campaign" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "count_type" varchar NOT NULL DEFAULT 'PERIODIC',
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "cutoff_time" TIMESTAMPTZ,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_inventory_count_campaign" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_icc_campaign_code" ON "inventory_count_campaign" ("campaign_code")');
    await queryRunner.query('CREATE INDEX "IDX_icc_status" ON "inventory_count_campaign" ("status")');

    // ---- book_snapshot / book_snapshot_line ----
    await queryRunner.query(`
      CREATE TABLE "book_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "as_of" TIMESTAMPTZ NOT NULL,
        "checksum" varchar NOT NULL,
        "locked" boolean NOT NULL DEFAULT true,
        ${abstractCols},
        CONSTRAINT "PK_book_snapshot" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_book_snapshot_campaign" ON "book_snapshot" ("campaign_id")');
    await queryRunner.query(`
      CREATE TABLE "book_snapshot_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid,
        "location_id" uuid,
        "organization_id" uuid,
        "book_qty" numeric(18,3) NOT NULL DEFAULT 0,
        ${g5},
        "value" numeric(18,2),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_book_snapshot_line" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_book_snapshot_line_snap" ON "book_snapshot_line" ("snapshot_id")');

    // ---- count_sheet / count_line ----
    await queryRunner.query(`
      CREATE TABLE "count_sheet" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "organization_id" uuid,
        "location_id" uuid,
        "assignee" uuid,
        "current_round" int NOT NULL DEFAULT 1,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "submitted_at" TIMESTAMPTZ,
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_count_sheet" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_count_sheet_campaign" ON "count_sheet" ("campaign_id")');
    await queryRunner.query('CREATE INDEX "IDX_count_sheet_status" ON "count_sheet" ("status")');
    await queryRunner.query(`
      CREATE TABLE "count_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sheet_id" uuid NOT NULL,
        "round_no" int NOT NULL DEFAULT 1,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid,
        "location_id" uuid,
        "physical_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_count_line" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_count_line_sheet" ON "count_line" ("sheet_id")');

    // ---- recount_round ----
    await queryRunner.query(`
      CREATE TABLE "recount_round" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "count_sheet_id" uuid NOT NULL,
        "round_no" int NOT NULL,
        "reason" text,
        ${abstractCols},
        CONSTRAINT "PK_recount_round" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_recount_round_sheet" ON "recount_round" ("count_sheet_id")');

    // ---- count_variance ----
    await queryRunner.query(`
      CREATE TABLE "count_variance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid,
        "location_id" uuid,
        "organization_id" uuid,
        "book_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "physical_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "variance_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "variance_type" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "resolution_note" text,
        ${abstractCols},
        CONSTRAINT "PK_count_variance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_count_variance_campaign" ON "count_variance" ("campaign_id")');
    await queryRunner.query('CREATE INDEX "IDX_count_variance_status" ON "count_variance" ("status")');

    // ---- count_quality_grade ----
    await queryRunner.query(`
      CREATE TABLE "count_quality_grade" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "count_line_id" uuid NOT NULL,
        ${g5},
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_count_quality_grade" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_count_quality_grade_line" ON "count_quality_grade" ("count_line_id")');

    // ---- official_snapshot / official_snapshot_line / official_lock ----
    await queryRunner.query(`
      CREATE TABLE "official_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "version" int NOT NULL DEFAULT 1,
        "approved_at" TIMESTAMPTZ,
        "checksum" varchar NOT NULL,
        "revision_reason" text,
        ${abstractCols},
        CONSTRAINT "PK_official_snapshot" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_official_snapshot_campaign" ON "official_snapshot" ("campaign_id")');
    await queryRunner.query(`
      CREATE TABLE "official_snapshot_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid,
        "location_id" uuid,
        "organization_id" uuid,
        "official_qty" numeric(18,3) NOT NULL DEFAULT 0,
        ${g5},
        "value" numeric(18,2),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_official_snapshot_line" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_official_snapshot_line_snap" ON "official_snapshot_line" ("snapshot_id")');
    await queryRunner.query(`
      CREATE TABLE "official_lock" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "snapshot_id" uuid NOT NULL,
        "snapshot_version" int NOT NULL,
        "locked_by" uuid,
        "locked_at" TIMESTAMPTZ NOT NULL,
        "unlock_reason" text,
        "unlocked_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_official_lock" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_official_lock_campaign" ON "official_lock" ("campaign_id")');

    // ---- count_adjustment_request ----
    await queryRunner.query(`
      CREATE TABLE "count_adjustment_request" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_code" varchar NOT NULL,
        "campaign_id" uuid NOT NULL,
        "variance_id" uuid,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid,
        "organization_id" uuid NOT NULL,
        "location_id" uuid,
        "before_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "proposed_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "proposed_delta" numeric(18,3) NOT NULL DEFAULT 0,
        "reason_code" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "dt05_document_id" uuid,
        "approved_by" uuid,
        ${abstractCols},
        CONSTRAINT "PK_count_adjustment_request" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_count_adj_request_code" ON "count_adjustment_request" ("request_code")');
    await queryRunner.query('CREATE INDEX "IDX_count_adj_campaign" ON "count_adjustment_request" ("campaign_id")');
    await queryRunner.query('CREATE INDEX "IDX_count_adj_status" ON "count_adjustment_request" ("status")');

    // ---- report_dataset ----
    await queryRunner.query(`
      CREATE TABLE "report_dataset" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "form_code" varchar NOT NULL,
        "snapshot_version" int NOT NULL,
        "dataset_hash" varchar NOT NULL,
        "payload_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ${abstractCols},
        CONSTRAINT "PK_report_dataset" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_report_dataset_campaign" ON "report_dataset" ("campaign_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "report_dataset"');
    await queryRunner.query('DROP TABLE IF EXISTS "count_adjustment_request"');
    await queryRunner.query('DROP TABLE IF EXISTS "official_lock"');
    await queryRunner.query('DROP TABLE IF EXISTS "official_snapshot_line"');
    await queryRunner.query('DROP TABLE IF EXISTS "official_snapshot"');
    await queryRunner.query('DROP TABLE IF EXISTS "count_quality_grade"');
    await queryRunner.query('DROP TABLE IF EXISTS "count_variance"');
    await queryRunner.query('DROP TABLE IF EXISTS "recount_round"');
    await queryRunner.query('DROP TABLE IF EXISTS "count_line"');
    await queryRunner.query('DROP TABLE IF EXISTS "count_sheet"');
    await queryRunner.query('DROP TABLE IF EXISTS "book_snapshot_line"');
    await queryRunner.query('DROP TABLE IF EXISTS "book_snapshot"');
    await queryRunner.query('DROP TABLE IF EXISTS "inventory_count_campaign"');
  }
}
