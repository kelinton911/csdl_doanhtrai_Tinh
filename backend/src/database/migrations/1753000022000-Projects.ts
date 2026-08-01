import { MigrationInterface, QueryRunner } from 'typeorm';

// M13 — Xây dựng cơ bản & dự án đầu tư: dự án (vòng đời phase) + mốc tiến độ/nghiệm thu/giải ngân.
export class Projects1753000022000 implements MigrationInterface {
  name = 'Projects1753000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "project_type" varchar NOT NULL,
        "barracks_id" uuid,
        "area_id" uuid,
        "organization_id" uuid,
        "funding_source" varchar,
        "total_estimate" numeric(16,2) NOT NULL DEFAULT 0,
        "approved_capital" numeric(16,2) NOT NULL DEFAULT 0,
        "contractor_name" varchar,
        "contract_no" varchar,
        "contract_value" numeric(16,2) NOT NULL DEFAULT 0,
        "contract_signed_date" date,
        "start_date" date,
        "planned_end_date" date,
        "actual_end_date" date,
        "progress_percent" integer NOT NULL DEFAULT 0,
        "phase" varchar NOT NULL DEFAULT 'PROPOSAL',
        "facility_id" uuid,
        "description" text,
        "notes" text,
        "location" geometry(Point, 4326),
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_projects_code" ON "projects" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_projects_phase" ON "projects" ("phase")');

    await queryRunner.query(`
      CREATE TABLE "project_milestones" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "title" varchar NOT NULL,
        "milestone_date" date NOT NULL,
        "kind" varchar NOT NULL DEFAULT 'PROGRESS',
        "progress_percent" integer,
        "amount" numeric(16,2),
        "note" text,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_milestones" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_project_milestone" ON "project_milestones" ("project_id", "milestone_date")');
    await queryRunner.query(
      'ALTER TABLE "project_milestones" ADD CONSTRAINT "FK_milestone_project" ' +
        'FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "project_milestones"');
    await queryRunner.query('DROP TABLE IF EXISTS "projects"');
  }
}
