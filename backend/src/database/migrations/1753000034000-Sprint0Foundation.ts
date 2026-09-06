import { MigrationInterface, QueryRunner } from 'typeorm';

// Sprint 0 §1 GAP-7 (outbox) + GAP-9 (C3 catalog). Reversible.
export class Sprint0Foundation1753000034000 implements MigrationInterface {
  name = 'Sprint0Foundation1753000034000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // ---- Outbox pattern ----
    await queryRunner.query(`
      CREATE TABLE "outbox_event" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "aggregate_type" varchar NOT NULL,
        "aggregate_id" varchar NOT NULL,
        "event_type" varchar NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "attempts" int NOT NULL DEFAULT 0,
        "correlation_id" varchar,
        "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "published_at" TIMESTAMPTZ,
        "last_error" text,
        CONSTRAINT "PK_outbox_event" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_outbox_status_occurred" ON "outbox_event" ("status", "occurred_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_outbox_aggregate_type" ON "outbox_event" ("aggregate_type")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_outbox_event_type" ON "outbox_event" ("event_type")',
    );

    // ---- C3 catalog (ma trận truy vết) ----
    await queryRunner.query(`
      CREATE TABLE "c3_catalog" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "c3_code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "subsystem" varchar NOT NULL,
        "use_case" varchar,
        "business_rule" varchar,
        "screen" varchar,
        "api" varchar,
        "test" varchar,
        "description" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_c3_catalog" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_c3_catalog_code" ON "c3_catalog" ("c3_code")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c3_catalog_subsystem" ON "c3_catalog" ("subsystem")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "c3_catalog"');
    await queryRunner.query('DROP TABLE IF EXISTS "outbox_event"');
  }
}
