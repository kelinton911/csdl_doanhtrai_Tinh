import { MigrationInterface, QueryRunner } from 'typeorm';

// M18/M19 — Địa điểm sơ tán/phân tán/dự bị + nhiệm vụ khắc phục hậu quả.
export class Readiness1753000027000 implements MigrationInterface {
  name = 'Readiness1753000027000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "deployment_sites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "site_type" varchar NOT NULL DEFAULT 'EVACUATION',
        "area_id" uuid,
        "address" varchar,
        "location" geometry(Point, 4326),
        "capacity" integer NOT NULL DEFAULT 0,
        "concealment" varchar,
        "access_road" varchar,
        "has_power" boolean NOT NULL DEFAULT false,
        "has_water" boolean NOT NULL DEFAULT false,
        "tent_capability" integer NOT NULL DEFAULT 0,
        "deploy_time_hours" numeric(6,1) NOT NULL DEFAULT 0,
        "readiness" varchar NOT NULL DEFAULT 'PARTIAL',
        "role" varchar NOT NULL DEFAULT 'PRIMARY',
        "defense_state" varchar NOT NULL DEFAULT 'SSCD',
        "notes" text,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_deployment_sites" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_site_code" ON "deployment_sites" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_site_type" ON "deployment_sites" ("site_type")');
    await queryRunner.query('CREATE INDEX "IDX_site_readiness" ON "deployment_sites" ("readiness")');
    await queryRunner.query('CREATE INDEX "IDX_site_status" ON "deployment_sites" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_site_geom" ON "deployment_sites" USING GIST ("location")');

    await queryRunner.query(`
      CREATE TABLE "recovery_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "severity" varchar NOT NULL DEFAULT 'MODERATE',
        "danger_zone" boolean NOT NULL DEFAULT false,
        "damage_event_id" uuid,
        "barracks_id" uuid,
        "area_id" uuid,
        "location" geometry(Point, 4326),
        "description" text,
        "needed_materials" text,
        "needed_forces" text,
        "assigned_note" text,
        "estimated_loss" numeric(18,0) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'ASSESSING',
        "occurred_at" TIMESTAMPTZ,
        "resolved_at" TIMESTAMPTZ,
        "scenario" boolean NOT NULL DEFAULT false,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_recovery_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_recovery_code" ON "recovery_tasks" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_recovery_status" ON "recovery_tasks" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_recovery_danger" ON "recovery_tasks" ("danger_zone")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "recovery_tasks"');
    await queryRunner.query('DROP TABLE IF EXISTS "deployment_sites"');
  }
}
