import { MigrationInterface, QueryRunner } from 'typeorm';

// M08 — Documents: metadata tệp; nội dung tệp lưu ngoài CSDL (MinIO).
export class Documents1753000007000 implements MigrationInterface {
  name = 'Documents1753000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "content_type" varchar NOT NULL,
        "size" bigint NOT NULL DEFAULT 0,
        "checksum" varchar NOT NULL,
        "object_key" varchar NOT NULL,
        "classification" varchar,
        "entity_type" varchar,
        "entity_id" varchar,
        "version" integer NOT NULL DEFAULT 1,
        "uploaded_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_documents_entity" ON "documents" ("entity_type", "entity_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "documents"');
  }
}
