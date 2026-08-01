import { MigrationInterface, QueryRunner } from 'typeorm';

// M14 — Kế hoạch & ngân sách: dự toán + phân bổ hạn mức (khoản mục) + giải ngân/chứng từ.
export class Budgets1753000023000 implements MigrationInterface {
  name = 'Budgets1753000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "budget_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "fiscal_year" integer NOT NULL,
        "funding_source" varchar,
        "organization_id" uuid,
        "area_id" uuid,
        "planned_amount" numeric(16,2) NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_budget_plans" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_budget_code" ON "budget_plans" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_budget_year" ON "budget_plans" ("fiscal_year")');
    await queryRunner.query('CREATE INDEX "IDX_budget_status" ON "budget_plans" ("status")');

    await queryRunner.query(`
      CREATE TABLE "budget_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "budget_plan_id" uuid NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar NOT NULL DEFAULT 'OTHER',
        "allocated_amount" numeric(16,2) NOT NULL DEFAULT 0,
        "project_id" uuid,
        "note" text,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_lines" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_budget_line_plan" ON "budget_lines" ("budget_plan_id")');
    await queryRunner.query(
      'ALTER TABLE "budget_lines" ADD CONSTRAINT "FK_line_plan" FOREIGN KEY ("budget_plan_id") REFERENCES "budget_plans"("id") ON DELETE CASCADE',
    );

    await queryRunner.query(`
      CREATE TABLE "budget_expenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "budget_plan_id" uuid NOT NULL,
        "budget_line_id" uuid,
        "expense_date" date NOT NULL,
        "amount" numeric(16,2) NOT NULL,
        "voucher_no" varchar,
        "description" varchar,
        "project_id" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budget_expenses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_budget_expense_plan" ON "budget_expenses" ("budget_plan_id", "expense_date")');
    await queryRunner.query(
      'ALTER TABLE "budget_expenses" ADD CONSTRAINT "FK_expense_plan" FOREIGN KEY ("budget_plan_id") REFERENCES "budget_plans"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "budget_expenses"');
    await queryRunner.query('DROP TABLE IF EXISTS "budget_lines"');
    await queryRunner.query('DROP TABLE IF EXISTS "budget_plans"');
  }
}
