import { MigrationInterface, QueryRunner } from 'typeorm';

// M14 — Integration & Sync: lô nhập hàng loạt + lô đồng bộ offline.
export class Integration1753000011000 implements MigrationInterface {
  name = 'Integration1753000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "import_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "target" varchar NOT NULL,
        "filename" varchar,
        "status" varchar NOT NULL DEFAULT 'STAGED',
        "total_rows" integer NOT NULL DEFAULT 0,
        "valid_rows" integer NOT NULL DEFAULT 0,
        "error_rows" integer NOT NULL DEFAULT 0,
        "committed_count" integer NOT NULL DEFAULT 0,
        "staging" jsonb NOT NULL DEFAULT '[]',
        "errors" jsonb NOT NULL DEFAULT '[]',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_batches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "sync_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_key" varchar NOT NULL,
        "client_id" varchar,
        "items" jsonb NOT NULL DEFAULT '[]',
        "results" jsonb NOT NULL DEFAULT '[]',
        "status" varchar NOT NULL DEFAULT 'PROCESSED',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sync_batches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_sync_batch_key" ON "sync_batches" ("batch_key")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "sync_batches"');
    await queryRunner.query('DROP TABLE IF EXISTS "import_batches"');
  }
}
