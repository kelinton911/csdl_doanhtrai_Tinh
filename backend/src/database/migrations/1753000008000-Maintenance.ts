import { MigrationInterface, QueryRunner } from 'typeorm';

// M09 — Maintenance & Recovery: hư hỏng + yêu cầu sửa chữa.
export class Maintenance1753000008000 implements MigrationInterface {
  name = 'Maintenance1753000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "damage_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entity_type" varchar NOT NULL,
        "entity_id" uuid NOT NULL,
        "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "cause_code" varchar,
        "severity" varchar NOT NULL DEFAULT 'MEDIUM',
        "description" varchar,
        "estimated_loss" numeric(18,0) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'REPORTED',
        "scenario" boolean NOT NULL DEFAULT false,
        "reported_by" uuid,
        "verified_by" uuid,
        "verified_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_damage_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_damage_entity" ON "damage_events" ("entity_type", "entity_id")');

    await queryRunner.query(`
      CREATE TABLE "maintenance_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "barracks_id" uuid,
        "facility_id" uuid,
        "damage_event_id" uuid,
        "scope" varchar,
        "priority" varchar NOT NULL DEFAULT 'NORMAL',
        "estimated_cost" numeric(18,0) NOT NULL DEFAULT 0,
        "planned_days" integer NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "acceptance_note" varchar,
        "accepted_at" TIMESTAMPTZ,
        "created_by" uuid,
        "approved_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_maintenance_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_maint_code" ON "maintenance_requests" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_maint_barracks" ON "maintenance_requests" ("barracks_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "maintenance_requests"');
    await queryRunner.query('DROP TABLE IF EXISTS "damage_events"');
  }
}
