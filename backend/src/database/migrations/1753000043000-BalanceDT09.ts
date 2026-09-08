import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-09 — Nguồn địa bàn & cân đối bảo đảm (Quyển IX §III/§VII). 12 bảng, reversible.
// Nhận supply_required từ DT-08 (KHÔNG tính lại NC). Giữ chỗ chống overbooking (row_version).
// Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at, updated_at, row_version.
export class BalanceDT091753000043000 implements MigrationInterface {
  name = 'BalanceDT091753000043000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    // ---- territorial_source ----
    await queryRunner.query(`
      CREATE TABLE "territorial_source" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "admin_unit_id" uuid NOT NULL,
        "area_id" uuid,
        "source_type" varchar NOT NULL,
        "owner_name" varchar,
        "contact_name" varchar,
        "contact_phone" varchar,
        "address" varchar,
        "location" geometry(Point,4326),
        "local_resource_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "effective_from" date NOT NULL,
        "effective_to" date,
        "notes" text,
        ${abstractCols},
        CONSTRAINT "PK_territorial_source" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_territorial_source_code" ON "territorial_source" ("source_code")');
    await queryRunner.query('CREATE INDEX "IDX_territorial_source_admin_unit" ON "territorial_source" ("admin_unit_id")');
    await queryRunner.query('CREATE INDEX "IDX_territorial_source_status" ON "territorial_source" ("status")');

    // ---- source_material ----
    await queryRunner.query(`
      CREATE TABLE "source_material" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "declared_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "unit_id" uuid,
        "price" numeric(18,2),
        "as_of_time" TIMESTAMPTZ NOT NULL,
        "snapshot_checksum" varchar,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abstractCols},
        CONSTRAINT "PK_source_material" PRIMARY KEY ("id"),
        CONSTRAINT "FK_source_material_source" FOREIGN KEY ("source_id") REFERENCES "territorial_source"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_source_material_source" ON "source_material" ("source_id")');
    await queryRunner.query('CREATE INDEX "IDX_source_material_material" ON "source_material" ("material_catalog_id")');

    // ---- source_verification ----
    await queryRunner.query(`
      CREATE TABLE "source_verification" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_material_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'UNVERIFIED',
        "verified_qty" numeric(18,3),
        "verified_by" uuid,
        "verified_at" TIMESTAMPTZ,
        "evidence_file_id" uuid,
        "expires_at" TIMESTAMPTZ,
        "method" varchar,
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_source_verification" PRIMARY KEY ("id"),
        CONSTRAINT "FK_source_verification_material" FOREIGN KEY ("source_material_id") REFERENCES "source_material"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_source_verification_material" ON "source_verification" ("source_material_id")');

    // ---- verification_evidence ----
    await queryRunner.query(`
      CREATE TABLE "verification_evidence" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "verification_id" uuid NOT NULL,
        "file_id" uuid NOT NULL,
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_verification_evidence" PRIMARY KEY ("id"),
        CONSTRAINT "FK_verification_evidence_verification" FOREIGN KEY ("verification_id") REFERENCES "source_verification"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_verification_evidence_verification" ON "verification_evidence" ("verification_id")');

    // ---- mobilization_assessment ----
    await queryRunner.query(`
      CREATE TABLE "mobilization_assessment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "source_material_id" uuid NOT NULL,
        "mobilizable_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "lead_time_days" int NOT NULL DEFAULT 0,
        "readiness_level" varchar NOT NULL DEFAULT 'MEDIUM',
        "assessed_by" uuid,
        "assessed_at" TIMESTAMPTZ NOT NULL,
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_mobilization_assessment" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mobilization_assessment_material" FOREIGN KEY ("source_material_id") REFERENCES "source_material"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_mobilization_assessment_material" ON "mobilization_assessment" ("source_material_id")');

    // ---- balance_plan ----
    await queryRunner.query(`
      CREATE TABLE "balance_plan" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "scenario_run_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "revision_no" int NOT NULL DEFAULT 1,
        "based_on_id" uuid,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "source_output_hash" varchar,
        "deadline_days" int,
        "checksum" varchar,
        "source_fingerprint" varchar,
        "locked_at" TIMESTAMPTZ,
        "locked_by" uuid,
        ${abstractCols},
        CONSTRAINT "PK_balance_plan" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_balance_plan_code" ON "balance_plan" ("plan_code")');
    await queryRunner.query('CREATE INDEX "IDX_balance_plan_run" ON "balance_plan" ("scenario_run_id")');
    await queryRunner.query('CREATE INDEX "IDX_balance_plan_status" ON "balance_plan" ("status")');

    // ---- balance_line ----
    await queryRunner.query(`
      CREATE TABLE "balance_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "unit_id" uuid,
        "supply_required" numeric(18,3) NOT NULL DEFAULT 0,
        "planned_source_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "gap_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        ${abstractCols},
        CONSTRAINT "PK_balance_line" PRIMARY KEY ("id"),
        CONSTRAINT "FK_balance_line_plan" FOREIGN KEY ("plan_id") REFERENCES "balance_plan"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_balance_line_plan" ON "balance_line" ("plan_id")');
    await queryRunner.query('CREATE INDEX "IDX_balance_line_material" ON "balance_line" ("material_catalog_id")');

    // ---- source_reservation ----
    await queryRunner.query(`
      CREATE TABLE "source_reservation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "balance_line_id" uuid NOT NULL,
        "source_material_id" uuid NOT NULL,
        "reserved_qty" numeric(18,3) NOT NULL,
        "priority" int NOT NULL DEFAULT 100,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "expires_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_source_reservation" PRIMARY KEY ("id"),
        CONSTRAINT "FK_source_reservation_line" FOREIGN KEY ("balance_line_id") REFERENCES "balance_line"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_source_reservation_material" FOREIGN KEY ("source_material_id") REFERENCES "source_material"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_source_reservation_line" ON "source_reservation" ("balance_line_id")');
    await queryRunner.query('CREATE INDEX "IDX_source_reservation_material" ON "source_reservation" ("source_material_id")');
    await queryRunner.query('CREATE INDEX "IDX_source_reservation_status" ON "source_reservation" ("status")');

    // ---- execution_request ----
    await queryRunner.query(`
      CREATE TABLE "execution_request" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "balance_line_id" uuid NOT NULL,
        "requested_qty" numeric(18,3) NOT NULL,
        "target_org" uuid,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "dt05_document_id" uuid,
        "delivered_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "feedback_note" text,
        ${abstractCols},
        CONSTRAINT "PK_execution_request" PRIMARY KEY ("id"),
        CONSTRAINT "FK_execution_request_line" FOREIGN KEY ("balance_line_id") REFERENCES "balance_line"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_execution_request_line" ON "execution_request" ("balance_line_id")');
    await queryRunner.query('CREATE INDEX "IDX_execution_request_status" ON "execution_request" ("status")');

    // ---- execution_feedback ----
    await queryRunner.query(`
      CREATE TABLE "execution_feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "execution_request_id" uuid NOT NULL,
        "delivered_qty" numeric(18,3) NOT NULL,
        "feedback_note" text,
        "fed_back_by" uuid,
        "fed_back_at" TIMESTAMPTZ NOT NULL,
        ${abstractCols},
        CONSTRAINT "PK_execution_feedback" PRIMARY KEY ("id"),
        CONSTRAINT "FK_execution_feedback_request" FOREIGN KEY ("execution_request_id") REFERENCES "execution_request"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_execution_feedback_request" ON "execution_feedback" ("execution_request_id")');

    // ---- balance_snapshot ----
    await queryRunner.query(`
      CREATE TABLE "balance_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "plan_revision_no" int NOT NULL,
        "approved_at" TIMESTAMPTZ NOT NULL,
        "checksum" varchar NOT NULL,
        "source_fingerprint" varchar NOT NULL,
        "locked" boolean NOT NULL DEFAULT true,
        ${abstractCols},
        CONSTRAINT "PK_balance_snapshot" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_balance_snapshot_plan" ON "balance_snapshot" ("plan_id")');

    // ---- balance_snapshot_line ----
    await queryRunner.query(`
      CREATE TABLE "balance_snapshot_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "supply_required" numeric(18,3) NOT NULL DEFAULT 0,
        "planned_source_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "gap_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "reservations_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_balance_snapshot_line" PRIMARY KEY ("id"),
        CONSTRAINT "FK_balance_snapshot_line_snapshot" FOREIGN KEY ("snapshot_id") REFERENCES "balance_snapshot"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_balance_snapshot_line_snapshot" ON "balance_snapshot_line" ("snapshot_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "balance_snapshot_line"');
    await queryRunner.query('DROP TABLE IF EXISTS "balance_snapshot"');
    await queryRunner.query('DROP TABLE IF EXISTS "execution_feedback"');
    await queryRunner.query('DROP TABLE IF EXISTS "execution_request"');
    await queryRunner.query('DROP TABLE IF EXISTS "source_reservation"');
    await queryRunner.query('DROP TABLE IF EXISTS "balance_line"');
    await queryRunner.query('DROP TABLE IF EXISTS "balance_plan"');
    await queryRunner.query('DROP TABLE IF EXISTS "mobilization_assessment"');
    await queryRunner.query('DROP TABLE IF EXISTS "verification_evidence"');
    await queryRunner.query('DROP TABLE IF EXISTS "source_verification"');
    await queryRunner.query('DROP TABLE IF EXISTS "source_material"');
    await queryRunner.query('DROP TABLE IF EXISTS "territorial_source"');
  }
}
