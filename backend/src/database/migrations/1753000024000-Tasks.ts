import { MigrationInterface, QueryRunner } from 'typeorm';

// M21 — Kế hoạch công tác & giao nhiệm vụ: nhiệm vụ (cây cha-con) + nhật ký cập nhật.
export class Tasks1753000024000 implements MigrationInterface {
  name = 'Tasks1753000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "description" text,
        "category" varchar NOT NULL DEFAULT 'OTHER',
        "priority" varchar NOT NULL DEFAULT 'NORMAL',
        "assigner_org_id" uuid,
        "assignee_org_id" uuid,
        "assignee_area_id" uuid,
        "assignee_user_id" uuid,
        "due_date" date,
        "progress_percent" integer NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'ASSIGNED',
        "target_value" numeric(16,2),
        "target_unit" varchar,
        "result_value" numeric(16,2),
        "parent_task_id" uuid,
        "linked_entity_type" varchar,
        "linked_entity_id" uuid,
        "result_note" text,
        "completed_at" TIMESTAMPTZ,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_tasks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_tasks_code" ON "tasks" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_tasks_status" ON "tasks" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_tasks_assignee_org" ON "tasks" ("assignee_org_id")');
    await queryRunner.query('CREATE INDEX "IDX_tasks_assignee_area" ON "tasks" ("assignee_area_id")');
    await queryRunner.query('CREATE INDEX "IDX_tasks_assignee_user" ON "tasks" ("assignee_user_id")');
    await queryRunner.query('CREATE INDEX "IDX_tasks_parent" ON "tasks" ("parent_task_id")');

    await queryRunner.query(`
      CREATE TABLE "task_updates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "kind" varchar NOT NULL DEFAULT 'PROGRESS',
        "progress_percent" integer,
        "note" text,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_updates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_task_update_task" ON "task_updates" ("task_id", "created_at")');
    await queryRunner.query(
      'ALTER TABLE "task_updates" ADD CONSTRAINT "FK_update_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "task_updates"');
    await queryRunner.query('DROP TABLE IF EXISTS "tasks"');
  }
}
