import { MigrationInterface, QueryRunner } from 'typeorm';

// M22 — Kiểm tra, thanh tra: cuộc kiểm tra + phát hiện/kiến nghị (theo dõi khắc phục).
export class Oversight1753000025000 implements MigrationInterface {
  name = 'Oversight1753000025000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inspections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "inspection_type" varchar NOT NULL DEFAULT 'PERIODIC',
        "scope" text,
        "target_org_id" uuid,
        "target_area_id" uuid,
        "target_barracks_id" uuid,
        "lead_name" varchar,
        "team_note" text,
        "planned_date" date,
        "start_date" date,
        "end_date" date,
        "status" varchar NOT NULL DEFAULT 'PLANNED',
        "conclusion" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_inspections" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_inspections_code" ON "inspections" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_inspections_status" ON "inspections" ("status")');

    await queryRunner.query(`
      CREATE TABLE "inspection_findings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inspection_id" uuid NOT NULL,
        "title" varchar NOT NULL,
        "severity" varchar NOT NULL DEFAULT 'MEDIUM',
        "recommendation" text,
        "responsible_org_id" uuid,
        "responsible_area_id" uuid,
        "due_date" date,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "resolution_note" text,
        "resolved_at" TIMESTAMPTZ,
        "linked_entity_type" varchar,
        "linked_entity_id" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inspection_findings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_finding_inspection" ON "inspection_findings" ("inspection_id")');
    await queryRunner.query('CREATE INDEX "IDX_finding_status" ON "inspection_findings" ("status")');
    await queryRunner.query(
      'ALTER TABLE "inspection_findings" ADD CONSTRAINT "FK_finding_inspection" FOREIGN KEY ("inspection_id") REFERENCES "inspections"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "inspection_findings"');
    await queryRunner.query('DROP TABLE IF EXISTS "inspections"');
  }
}
