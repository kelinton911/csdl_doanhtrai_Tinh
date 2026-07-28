import { MigrationInterface, QueryRunner } from 'typeorm';

// M10 — Scenario & Planning: tình huống, lần chạy, phương án.
export class Scenario1753000009000 implements MigrationInterface {
  name = 'Scenario1753000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "scenarios" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "parameters" jsonb NOT NULL DEFAULT '{}',
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_scenarios" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_scenario_code" ON "scenarios" ("code")');

    await queryRunner.query(`
      CREATE TABLE "scenario_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scenario_id" uuid NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "algorithm" varchar NOT NULL DEFAULT 'assurance-v1',
        "input_snapshot" jsonb NOT NULL DEFAULT '{}',
        "metrics" jsonb NOT NULL DEFAULT '{}',
        "run_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scenario_runs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_run_scenario" ON "scenario_runs" ("scenario_id")');

    await queryRunner.query(`
      CREATE TABLE "plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "scenario_run_id" uuid NOT NULL,
        "allocations" jsonb NOT NULL DEFAULT '{}',
        "assumptions" varchar,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "approved_by" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_plans" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_plan_code" ON "plans" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_plan_run" ON "plans" ("scenario_run_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "plans"');
    await queryRunner.query('DROP TABLE IF EXISTS "scenario_runs"');
    await queryRunner.query('DROP TABLE IF EXISTS "scenarios"');
  }
}
