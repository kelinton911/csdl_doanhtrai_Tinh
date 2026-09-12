import { MigrationInterface, QueryRunner } from 'typeorm';

// Biểu mẫu định mức khai báo: bộ mã vật chất chuẩn tái dùng (áp vào bản khai → chỉ điền số lượng).
export class DeclarationTemplate1753000052000 implements MigrationInterface {
  name = 'DeclarationTemplate1753000052000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TABLE "declaration_templates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "note" text,
        "organization_id" uuid,
        "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_declaration_templates" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_declaration_templates_code" ON "declaration_templates" ("code")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "declaration_templates"');
  }
}
