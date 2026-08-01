import { MigrationInterface, QueryRunner } from 'typeorm';

// Trục B — Khai báo vật chất SSCĐ theo 4 mức (Thường xuyên→Tăng cường→Cao→Toàn bộ).
// Bản/mức/xã (unique area_id + readiness_state); dòng theo khung KKDT (cấp chất lượng 1–5);
// revision bất biến. Workflow dùng chung DRAFT→PENDING_REVIEW→APPROVED.
export class ReadinessMaterials1753000028000 implements MigrationInterface {
  name = 'ReadinessMaterials1753000028000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "readiness_material_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "area_id" uuid NOT NULL,
        "organization_id" uuid,
        "readiness_state" varchar NOT NULL,
        "workflow_status" varchar NOT NULL DEFAULT 'DRAFT',
        "copied_from_state" varchar,
        "copied_from_plan_id" uuid,
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_readiness_material_plans" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_rmp_area_state" ON "readiness_material_plans" ("area_id", "readiness_state")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_rmp_status" ON "readiness_material_plans" ("workflow_status")',
    );

    await queryRunner.query(`
      CREATE TABLE "readiness_material_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "material_id" uuid NOT NULL,
        "unit_code" varchar,
        "qty_grade_1" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_2" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_3" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_4" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_5" numeric(18,3) NOT NULL DEFAULT 0,
        "note" varchar,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_readiness_material_lines" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_rml_plan" ON "readiness_material_lines" ("plan_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "readiness_material_plan_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "revision_no" integer NOT NULL,
        "payload" jsonb NOT NULL,
        "workflow_status" varchar NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_readiness_material_plan_revisions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_rmpr_plan_no" ON "readiness_material_plan_revisions" ("plan_id", "revision_no")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "readiness_material_plan_revisions"');
    await queryRunner.query('DROP TABLE IF EXISTS "readiness_material_lines"');
    await queryRunner.query('DROP TABLE IF EXISTS "readiness_material_plans"');
  }
}
