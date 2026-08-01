import { MigrationInterface, QueryRunner } from 'typeorm';

// M20 — Văn bản, tiêu chuẩn, định mức: sổ đăng ký văn bản pháp quy.
export class LegalDocuments1753000026000 implements MigrationInterface {
  name = 'LegalDocuments1753000026000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "legal_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "doc_number" varchar NOT NULL,
        "title" varchar NOT NULL,
        "doc_type" varchar NOT NULL DEFAULT 'OTHER',
        "issuing_body" varchar,
        "issued_date" date,
        "effective_date" date,
        "expiry_date" date,
        "effective_status" varchar NOT NULL DEFAULT 'EFFECTIVE',
        "field" varchar NOT NULL DEFAULT 'CHUNG',
        "confidentiality" varchar NOT NULL DEFAULT 'INTERNAL',
        "summary" text,
        "keywords" text,
        "supersedes_id" uuid,
        "source_url" varchar,
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_legal_documents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_legaldoc_code" ON "legal_documents" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_legaldoc_number" ON "legal_documents" ("doc_number")');
    await queryRunner.query('CREATE INDEX "IDX_legaldoc_type" ON "legal_documents" ("doc_type")');
    await queryRunner.query('CREATE INDEX "IDX_legaldoc_status" ON "legal_documents" ("effective_status")');
    await queryRunner.query('CREATE INDEX "IDX_legaldoc_field" ON "legal_documents" ("field")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "legal_documents"');
  }
}
