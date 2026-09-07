import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-08 — Engine tính nhu cầu NC = TT + PC_SSCĐ − HC (Quyển VIII §VIII/§XV).
// 7 bảng, reversible. Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at,
// updated_at, row_version. Trị số NC/TT nullable (NO_RULE/CONFLICT KHÔNG quy 0).
export class CalculationDT081753000042000 implements MigrationInterface {
  name = 'CalculationDT081753000042000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    // ---- calculation_scenario ----
    await queryRunner.query(`
      CREATE TABLE "calculation_scenario" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scenario_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "mission_id" uuid,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "effective_time" TIMESTAMPTZ NOT NULL,
        "engine_version" varchar NOT NULL DEFAULT 'dt08-need-v1',
        "revision_no" int NOT NULL DEFAULT 1,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "based_on_id" uuid,
        "hc_snapshot_id" uuid,
        "locked_at" TIMESTAMPTZ,
        "locked_by" uuid,
        ${abstractCols},
        CONSTRAINT "PK_calculation_scenario" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_calc_scenario_code" ON "calculation_scenario" ("scenario_code")');
    await queryRunner.query('CREATE INDEX "IDX_calc_scenario_status" ON "calculation_scenario" ("status")');

    // ---- calculation_run ----
    await queryRunner.query(`
      CREATE TABLE "calculation_run" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scenario_id" uuid NOT NULL,
        "run_no" int NOT NULL DEFAULT 1,
        "input_hash" varchar NOT NULL,
        "output_hash" varchar,
        "engine_version" varchar NOT NULL DEFAULT 'dt08-need-v1',
        "status" varchar NOT NULL DEFAULT 'RUNNING',
        "line_count" int NOT NULL DEFAULT 0,
        "exception_count" int NOT NULL DEFAULT 0,
        "started_at" TIMESTAMPTZ,
        "finished_at" TIMESTAMPTZ,
        ${abstractCols},
        CONSTRAINT "PK_calculation_run" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_calc_run_scenario" ON "calculation_run" ("scenario_id")');
    await queryRunner.query('CREATE INDEX "IDX_calc_run_input_hash" ON "calculation_run" ("input_hash")');

    // ---- material_calculation ----
    await queryRunner.query(`
      CREATE TABLE "material_calculation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "phase" varchar,
        "tt_gdcb" numeric(18,4),
        "tt_gdcd" numeric(18,4),
        "tt" numeric(18,4),
        "pc_sscd" numeric(18,4),
        "hc" numeric(18,4),
        "nc" numeric(18,4),
        "supply_required" numeric(18,4),
        "unit_id" uuid,
        "rule_status" varchar NOT NULL,
        "hc_status" varchar NOT NULL DEFAULT 'OK',
        ${abstractCols},
        CONSTRAINT "PK_material_calculation" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_material_calc_run" ON "material_calculation" ("run_id")');
    await queryRunner.query('CREATE INDEX "IDX_material_calc_rule_status" ON "material_calculation" ("rule_status")');
    await queryRunner.query(
      'CREATE INDEX "IDX_material_calculation_run_mat" ON "material_calculation" ("run_id", "material_catalog_id")',
    );

    // ---- rule_resolution_snapshot ----
    await queryRunner.query(`
      CREATE TABLE "rule_resolution_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "material_calculation_id" uuid,
        "material_catalog_id" uuid NOT NULL,
        "semantic_param" varchar NOT NULL,
        "resolved_norm_id" uuid,
        "status" varchar NOT NULL,
        "source_reference" text,
        "explanation_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ${abstractCols},
        CONSTRAINT "PK_rule_resolution_snapshot" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_rule_res_run" ON "rule_resolution_snapshot" ("run_id")');
    await queryRunner.query('CREATE INDEX "IDX_rule_res_calc" ON "rule_resolution_snapshot" ("material_calculation_id")');

    // ---- hc_snapshot_ref ----
    await queryRunner.query(`
      CREATE TABLE "hc_snapshot_ref" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "dt04_snapshot_id" uuid,
        "as_of_time" TIMESTAMPTZ,
        "scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "locked" boolean NOT NULL DEFAULT false,
        ${abstractCols},
        CONSTRAINT "PK_hc_snapshot_ref" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_hc_snapshot_ref_run" ON "hc_snapshot_ref" ("run_id")');

    // ---- calculation_trace_node ----
    await queryRunner.query(`
      CREATE TABLE "calculation_trace_node" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "run_id" uuid NOT NULL,
        "material_calculation_id" uuid NOT NULL,
        "seq" int NOT NULL DEFAULT 0,
        "step_type" varchar NOT NULL,
        "input_refs" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "formula" text,
        "output_value" numeric(18,4),
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_calculation_trace_node" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_trace_node_run" ON "calculation_trace_node" ("run_id")');
    await queryRunner.query('CREATE INDEX "IDX_trace_node_calc" ON "calculation_trace_node" ("material_calculation_id")');

    // ---- scenario_comparison ----
    await queryRunner.query(`
      CREATE TABLE "scenario_comparison" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "base_run_id" uuid NOT NULL,
        "target_run_id" uuid NOT NULL,
        "delta_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ${abstractCols},
        CONSTRAINT "PK_scenario_comparison" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_scenario_cmp_base" ON "scenario_comparison" ("base_run_id")');
    await queryRunner.query('CREATE INDEX "IDX_scenario_cmp_target" ON "scenario_comparison" ("target_run_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "scenario_comparison"');
    await queryRunner.query('DROP TABLE IF EXISTS "calculation_trace_node"');
    await queryRunner.query('DROP TABLE IF EXISTS "hc_snapshot_ref"');
    await queryRunner.query('DROP TABLE IF EXISTS "rule_resolution_snapshot"');
    await queryRunner.query('DROP TABLE IF EXISTS "material_calculation"');
    await queryRunner.query('DROP TABLE IF EXISTS "calculation_run"');
    await queryRunner.query('DROP TABLE IF EXISTS "calculation_scenario"');
  }
}
