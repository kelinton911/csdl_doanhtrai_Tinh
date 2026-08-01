import { MigrationInterface, QueryRunner } from 'typeorm';

// Khâu 4 — Định mức/quy ước tính toán HC-KT (căn cứ: docs/Quiuoctinhtoan.pdf).
export class LogisticsNorms1753000029000 implements MigrationInterface {
  name = 'LogisticsNorms1753000029000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "logistics_calc_norms" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "branch" varchar NOT NULL,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "unit" varchar,
        "value" numeric(18,4),
        "basis" varchar,
        "calc_role" varchar NOT NULL DEFAULT 'REFERENCE',
        "attributes" jsonb NOT NULL DEFAULT '{}',
        "source" varchar,
        "sort_order" integer NOT NULL DEFAULT 0,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_logistics_calc_norms" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_lcn_branch_code" ON "logistics_calc_norms" ("branch", "code")',
    );
    await queryRunner.query('CREATE INDEX "IDX_lcn_branch" ON "logistics_calc_norms" ("branch")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "logistics_calc_norms"');
  }
}
