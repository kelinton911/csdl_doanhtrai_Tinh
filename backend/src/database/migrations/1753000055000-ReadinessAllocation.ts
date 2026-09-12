import { MigrationInterface, QueryRunner } from 'typeorm';

// Feature 03 — Phương án PHÂN CẤP LƯỢNG vật chất SSCĐ (top-down, cấp Tỉnh) theo 3 trạng thái
// (Tăng cường/Cao/Toàn bộ), phân bổ theo 4 cấp (kho Tỉnh/xã/trung đoàn/căn cứ) + revision bất biến.
export class ReadinessAllocation1753000055000 implements MigrationInterface {
  name = 'ReadinessAllocation1753000055000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "readiness_allocation_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "readiness_state" varchar NOT NULL,
        "title" varchar NOT NULL,
        "regulation_ref" text,
        "period_label" varchar,
        "workflow_status" varchar NOT NULL DEFAULT 'DRAFT',
        "locked_at" TIMESTAMPTZ,
        "locked_by" uuid,
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_readiness_allocation_plans" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rap_state_period" ON "readiness_allocation_plans" ("readiness_state", "period_label")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_rap_state" ON "readiness_allocation_plans" ("readiness_state")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "readiness_allocation_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "unit_id" uuid,
        "qty_kho_tinh" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_xa" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_trung_doan" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_can_cu" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_total" numeric(18,3) NOT NULL DEFAULT 0,
        "note" text,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_readiness_allocation_lines" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_ral_plan" ON "readiness_allocation_lines" ("plan_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_ral_catalog" ON "readiness_allocation_lines" ("material_catalog_id")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "readiness_allocation_plan_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "revision_no" int NOT NULL,
        "payload" jsonb NOT NULL,
        "workflow_status" varchar NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_readiness_allocation_plan_revisions" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rapr_plan_rev" ON "readiness_allocation_plan_revisions" ("plan_id", "revision_no")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "readiness_allocation_plan_revisions"');
    await queryRunner.query('DROP TABLE IF EXISTS "readiness_allocation_lines"');
    await queryRunner.query('DROP TABLE IF EXISTS "readiness_allocation_plans"');
  }
}
