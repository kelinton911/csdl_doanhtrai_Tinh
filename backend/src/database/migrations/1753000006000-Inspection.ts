import { MigrationInterface, QueryRunner } from 'typeorm';

// M07 — Inspection & Review: đợt kiểm kê, phiếu, dòng, nhiệm vụ kiểm duyệt.
export class Inspection1753000006000 implements MigrationInterface {
  name = 'Inspection1753000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inspection_campaigns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "scope" jsonb NOT NULL DEFAULT '{}',
        "status" varchar NOT NULL DEFAULT 'PLANNED',
        "planned_from" TIMESTAMPTZ,
        "planned_to" TIMESTAMPTZ,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_inspection_campaigns" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_campaign_code" ON "inspection_campaigns" ("code")');

    await queryRunner.query(`
      CREATE TABLE "inspection_sheets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "campaign_id" uuid NOT NULL,
        "barracks_id" uuid,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "note" varchar,
        "submitted_at" TIMESTAMPTZ,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_inspection_sheets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_sheet_campaign" ON "inspection_sheets" ("campaign_id")');
    await queryRunner.query('CREATE INDEX "IDX_sheet_barracks" ON "inspection_sheets" ("barracks_id")');

    await queryRunner.query(`
      CREATE TABLE "inspection_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sheet_id" uuid NOT NULL,
        "item_type" varchar NOT NULL,
        "item_ref" uuid,
        "label" varchar NOT NULL,
        "unit_code" varchar,
        "expected_quantity" numeric(18,3),
        "counted_quantity" numeric(18,3),
        "condition" varchar,
        "note" varchar,
        CONSTRAINT "PK_inspection_lines" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_line_sheet" ON "inspection_lines" ("sheet_id")');

    await queryRunner.query(`
      CREATE TABLE "review_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sheet_id" uuid NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "submitted_by" uuid,
        "reviewer_id" uuid,
        "decision_note" varchar,
        "decided_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_task_sheet" ON "review_tasks" ("sheet_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "review_tasks"');
    await queryRunner.query('DROP TABLE IF EXISTS "inspection_lines"');
    await queryRunner.query('DROP TABLE IF EXISTS "inspection_sheets"');
    await queryRunner.query('DROP TABLE IF EXISTS "inspection_campaigns"');
  }
}
