import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-12 — Dashboard chỉ huy (Quyển XII PHẦN VII/VIII/IX/XI). 23 bảng, reversible.
// Semantic/KPI: kpi_definition + kpi_formula_version + kpi_threshold + metric_instance (as_of_time + lineage +
// freshness). Data Mart star schema: dim_time/material/org/location/mission/quality + fact_inventory/requirement/
// balance/count + data_mart_refresh (refresh qua outbox — dẫn xuất). Alert cấu hình: alert_rule + alert_instance
// (OPEN→ACK→RESOLVED + SLA) + alert_assignment. Hỗ trợ quyết định: decision_session/option/criterion/score/record.
// Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at, updated_at, row_version.
export class DashboardDT121753000046000 implements MigrationInterface {
  name = 'DashboardDT121753000046000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    // ---- kpi_definition ----
    await queryRunner.query(`
      CREATE TABLE "kpi_definition" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kpi_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "semantic_ref" varchar NOT NULL,
        "unit" varchar,
        "description" text,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "current_version_no" int NOT NULL DEFAULT 0,
        ${abstractCols},
        CONSTRAINT "PK_kpi_definition" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_kpi_definition_code" ON "kpi_definition" ("kpi_code")');
    await queryRunner.query('CREATE INDEX "IDX_kpi_definition_semantic" ON "kpi_definition" ("semantic_ref")');
    await queryRunner.query('CREATE INDEX "IDX_kpi_definition_status" ON "kpi_definition" ("status")');

    // ---- kpi_formula_version ----
    await queryRunner.query(`
      CREATE TABLE "kpi_formula_version" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kpi_definition_id" uuid NOT NULL,
        "version_no" int NOT NULL,
        "formula_expr" text NOT NULL DEFAULT 'SUM(semantic)',
        "effective_from" TIMESTAMPTZ,
        "effective_to" TIMESTAMPTZ,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        ${abstractCols},
        CONSTRAINT "PK_kpi_formula_version" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_kfv_kpi" ON "kpi_formula_version" ("kpi_definition_id")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_kfv_kpi_version" ON "kpi_formula_version" ("kpi_definition_id", "version_no")');

    // ---- kpi_threshold ----
    await queryRunner.query(`
      CREATE TABLE "kpi_threshold" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kpi_definition_id" uuid NOT NULL,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "warn_level" numeric(18,4),
        "critical_level" numeric(18,4),
        "direction" varchar NOT NULL DEFAULT 'HIGHER_WORSE',
        ${abstractCols},
        CONSTRAINT "PK_kpi_threshold" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_kpi_threshold_kpi" ON "kpi_threshold" ("kpi_definition_id")');

    // ---- metric_instance ----
    await queryRunner.query(`
      CREATE TABLE "metric_instance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kpi_definition_id" uuid NOT NULL,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "as_of_time" TIMESTAMPTZ NOT NULL,
        "value" numeric(18,4),
        "source_as_of" TIMESTAMPTZ,
        "source_version" varchar,
        "lineage_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "freshness_status" varchar NOT NULL DEFAULT 'FRESH',
        "metric_hash" varchar NOT NULL,
        "computed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        ${abstractCols},
        CONSTRAINT "PK_metric_instance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_metric_kpi" ON "metric_instance" ("kpi_definition_id")');
    await queryRunner.query('CREATE INDEX "IDX_metric_asof" ON "metric_instance" ("as_of_time")');
    await queryRunner.query('CREATE INDEX "IDX_metric_kpi_asof" ON "metric_instance" ("kpi_definition_id", "as_of_time")');

    // ---- data_mart_refresh ----
    await queryRunner.query(`
      CREATE TABLE "data_mart_refresh" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fact_type" varchar NOT NULL,
        "source_ref_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "source_version" varchar,
        "refreshed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_count" int NOT NULL DEFAULT 0,
        "outbox_event_id" uuid,
        "freshness_status" varchar NOT NULL DEFAULT 'FRESH',
        ${abstractCols},
        CONSTRAINT "PK_data_mart_refresh" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_dm_refresh_fact" ON "data_mart_refresh" ("fact_type", "refreshed_at")');

    // ---- dim_* (star schema dimensions) ----
    await queryRunner.query(`
      CREATE TABLE "dim_time" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "date_key" date NOT NULL,
        "iso_time" TIMESTAMPTZ,
        CONSTRAINT "PK_dim_time" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dim_time_date" ON "dim_time" ("date_key")');

    await queryRunner.query(`
      CREATE TABLE "dim_material" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_catalog_id" uuid NOT NULL,
        CONSTRAINT "PK_dim_material" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dim_material" ON "dim_material" ("material_catalog_id")');

    await queryRunner.query(`
      CREATE TABLE "dim_org" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "org_id" uuid NOT NULL,
        CONSTRAINT "PK_dim_org" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dim_org" ON "dim_org" ("org_id")');

    await queryRunner.query(`
      CREATE TABLE "dim_location" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "area_id" uuid NOT NULL,
        CONSTRAINT "PK_dim_location" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dim_location" ON "dim_location" ("area_id")');

    await queryRunner.query(`
      CREATE TABLE "dim_mission" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "mission_id" uuid NOT NULL,
        CONSTRAINT "PK_dim_mission" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dim_mission" ON "dim_mission" ("mission_id")');

    await queryRunner.query(`
      CREATE TABLE "dim_quality" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "grade_code" varchar NOT NULL,
        CONSTRAINT "PK_dim_quality" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dim_quality" ON "dim_quality" ("grade_code")');

    // ---- fact_* (measures + FK dims + snapshot_ref) ----
    await queryRunner.query(`
      CREATE TABLE "fact_inventory" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "refresh_id" uuid NOT NULL,
        "dim_material_id" uuid NOT NULL,
        "dim_org_id" uuid,
        "dim_time_id" uuid,
        "dim_quality_id" uuid,
        "on_hand" numeric(18,4) NOT NULL DEFAULT 0,
        "available" numeric(18,4),
        "snapshot_ref" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fact_inventory" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_fact_inventory_mat" ON "fact_inventory" ("dim_material_id")');

    await queryRunner.query(`
      CREATE TABLE "fact_requirement" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "refresh_id" uuid NOT NULL,
        "dim_material_id" uuid NOT NULL,
        "dim_time_id" uuid,
        "tt" numeric(18,4),
        "pc_sscd" numeric(18,4),
        "hc" numeric(18,4),
        "nc" numeric(18,4),
        "supply_required" numeric(18,4),
        "run_ref" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fact_requirement" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_fact_requirement_mat" ON "fact_requirement" ("dim_material_id")');

    await queryRunner.query(`
      CREATE TABLE "fact_balance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "refresh_id" uuid NOT NULL,
        "dim_material_id" uuid NOT NULL,
        "dim_time_id" uuid,
        "supply_required" numeric(18,4),
        "planned_source" numeric(18,4),
        "gap" numeric(18,4),
        "snapshot_ref" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fact_balance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_fact_balance_mat" ON "fact_balance" ("dim_material_id")');

    await queryRunner.query(`
      CREATE TABLE "fact_count" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "refresh_id" uuid NOT NULL,
        "dim_material_id" uuid NOT NULL,
        "dim_time_id" uuid,
        "official_qty" numeric(18,4),
        "snapshot_ref" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fact_count" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_fact_count_mat" ON "fact_count" ("dim_material_id")');

    // ---- alert_rule ----
    await queryRunner.query(`
      CREATE TABLE "alert_rule" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rule_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "kpi_definition_id" uuid NOT NULL,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "warn_level" numeric(18,4),
        "critical_level" numeric(18,4),
        "direction" varchar NOT NULL DEFAULT 'HIGHER_WORSE',
        "sla_hours" int NOT NULL DEFAULT 72,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abstractCols},
        CONSTRAINT "PK_alert_rule" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_alert_rule_code" ON "alert_rule" ("rule_code")');
    await queryRunner.query('CREATE INDEX "IDX_alert_rule_kpi" ON "alert_rule" ("kpi_definition_id")');

    // ---- alert_instance ----
    await queryRunner.query(`
      CREATE TABLE "alert_instance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rule_id" uuid NOT NULL,
        "kpi_definition_id" uuid NOT NULL,
        "metric_instance_id" uuid,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "as_of_time" TIMESTAMPTZ NOT NULL,
        "value" numeric(18,4),
        "severity" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "dedupe_key" varchar NOT NULL,
        "due_at" TIMESTAMPTZ,
        "acked_at" TIMESTAMPTZ,
        "resolved_at" TIMESTAMPTZ,
        "resolution" text,
        ${abstractCols},
        CONSTRAINT "PK_alert_instance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_alert_instance_rule" ON "alert_instance" ("rule_id")');
    await queryRunner.query('CREATE INDEX "IDX_alert_instance_status" ON "alert_instance" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_alert_instance_dedupe" ON "alert_instance" ("rule_id", "dedupe_key", "status")');

    // ---- alert_assignment ----
    await queryRunner.query(`
      CREATE TABLE "alert_assignment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "alert_instance_id" uuid NOT NULL,
        "assignee_id" uuid NOT NULL,
        "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "note" text,
        ${abstractCols},
        CONSTRAINT "PK_alert_assignment" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_alert_assignment_alert" ON "alert_assignment" ("alert_instance_id")');

    // ---- decision_session ----
    await queryRunner.query(`
      CREATE TABLE "decision_session" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "scope_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "baseline_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "params_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        ${abstractCols},
        CONSTRAINT "PK_decision_session" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_decision_session_code" ON "decision_session" ("session_code")');

    // ---- decision_option ----
    await queryRunner.query(`
      CREATE TABLE "decision_option" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "option_key" varchar NOT NULL,
        "label" varchar NOT NULL,
        "params_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        ${abstractCols},
        CONSTRAINT "PK_decision_option" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_decision_option_session" ON "decision_option" ("session_id")');

    // ---- decision_criterion ----
    await queryRunner.query(`
      CREATE TABLE "decision_criterion" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "criterion_key" varchar NOT NULL,
        "label" varchar NOT NULL,
        "weight" numeric(8,4) NOT NULL DEFAULT 1,
        "direction" varchar NOT NULL DEFAULT 'HIGHER_BETTER',
        ${abstractCols},
        CONSTRAINT "PK_decision_criterion" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_decision_criterion_session" ON "decision_criterion" ("session_id")');

    // ---- decision_score ----
    await queryRunner.query(`
      CREATE TABLE "decision_score" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "option_id" uuid NOT NULL,
        "criterion_id" uuid NOT NULL,
        "raw_value" numeric(18,4),
        "normalized" numeric(10,6),
        "weighted" numeric(10,6),
        ${abstractCols},
        CONSTRAINT "PK_decision_score" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_decision_score_session" ON "decision_score" ("session_id")');
    await queryRunner.query('CREATE INDEX "IDX_decision_score_opt_crit" ON "decision_score" ("option_id", "criterion_id")');

    // ---- decision_record ----
    await queryRunner.query(`
      CREATE TABLE "decision_record" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "session_id" uuid NOT NULL,
        "chosen_option_id" uuid,
        "rationale" text,
        "recorded_by" uuid,
        "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        ${abstractCols},
        CONSTRAINT "PK_decision_record" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_decision_record_session" ON "decision_record" ("session_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "decision_record"');
    await queryRunner.query('DROP TABLE IF EXISTS "decision_score"');
    await queryRunner.query('DROP TABLE IF EXISTS "decision_criterion"');
    await queryRunner.query('DROP TABLE IF EXISTS "decision_option"');
    await queryRunner.query('DROP TABLE IF EXISTS "decision_session"');
    await queryRunner.query('DROP TABLE IF EXISTS "alert_assignment"');
    await queryRunner.query('DROP TABLE IF EXISTS "alert_instance"');
    await queryRunner.query('DROP TABLE IF EXISTS "alert_rule"');
    await queryRunner.query('DROP TABLE IF EXISTS "fact_count"');
    await queryRunner.query('DROP TABLE IF EXISTS "fact_balance"');
    await queryRunner.query('DROP TABLE IF EXISTS "fact_requirement"');
    await queryRunner.query('DROP TABLE IF EXISTS "fact_inventory"');
    await queryRunner.query('DROP TABLE IF EXISTS "dim_quality"');
    await queryRunner.query('DROP TABLE IF EXISTS "dim_mission"');
    await queryRunner.query('DROP TABLE IF EXISTS "dim_location"');
    await queryRunner.query('DROP TABLE IF EXISTS "dim_org"');
    await queryRunner.query('DROP TABLE IF EXISTS "dim_material"');
    await queryRunner.query('DROP TABLE IF EXISTS "dim_time"');
    await queryRunner.query('DROP TABLE IF EXISTS "data_mart_refresh"');
    await queryRunner.query('DROP TABLE IF EXISTS "metric_instance"');
    await queryRunner.query('DROP TABLE IF EXISTS "kpi_threshold"');
    await queryRunner.query('DROP TABLE IF EXISTS "kpi_formula_version"');
    await queryRunner.query('DROP TABLE IF EXISTS "kpi_definition"');
  }
}
