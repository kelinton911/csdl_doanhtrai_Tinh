import { MigrationInterface, QueryRunner } from 'typeorm';

// M13 Alerts + M12 Reporting: bảng cảnh báo và tác vụ xuất báo cáo.
export class AlertsReporting1753000010000 implements MigrationInterface {
  name = 'AlertsReporting1753000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "alert_type" varchar NOT NULL,
        "severity" varchar NOT NULL DEFAULT 'MEDIUM',
        "title" varchar NOT NULL,
        "description" varchar,
        "entity_type" varchar,
        "entity_id" varchar,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "assignee_id" uuid,
        "due_at" TIMESTAMPTZ,
        "resolution" varchar,
        "closed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_alerts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_alert_type_entity" ON "alerts" ("alert_type", "entity_id")');
    await queryRunner.query('CREATE INDEX "IDX_alert_status" ON "alerts" ("status")');

    await queryRunner.query(`
      CREATE TABLE "report_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "template" varchar NOT NULL,
        "format" varchar NOT NULL,
        "filters" jsonb NOT NULL DEFAULT '{}',
        "status" varchar NOT NULL DEFAULT 'QUEUED',
        "row_count" integer NOT NULL DEFAULT 0,
        "object_key" varchar,
        "snapshot_at" TIMESTAMPTZ,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_jobs" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "report_jobs"');
    await queryRunner.query('DROP TABLE IF EXISTS "alerts"');
  }
}
