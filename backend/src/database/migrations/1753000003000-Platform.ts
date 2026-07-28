import { MigrationInterface, QueryRunner } from 'typeorm';

// Pha A — Nền tảng xuyên suốt: audit append-only, idempotency, phạm vi dữ liệu người dùng.
export class Platform1753000003000 implements MigrationInterface {
  name = 'Platform1753000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" uuid,
        "actor_name" varchar,
        "action" varchar NOT NULL,
        "entity_type" varchar,
        "entity_id" varchar,
        "method" varchar,
        "path" varchar,
        "status_code" integer,
        "before" jsonb,
        "after" jsonb,
        "correlation_id" varchar,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_audit_actor" ON "audit_logs" ("actor_id")');
    await queryRunner.query('CREATE INDEX "IDX_audit_entity" ON "audit_logs" ("entity_type")');
    await queryRunner.query('CREATE INDEX "IDX_audit_action" ON "audit_logs" ("action")');
    await queryRunner.query('CREATE INDEX "IDX_audit_corr" ON "audit_logs" ("correlation_id")');

    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id" varchar NOT NULL,
        "status_code" integer NOT NULL,
        "response" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_idempotency_keys" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "data_scopes" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "data_scopes"');
    await queryRunner.query('DROP TABLE IF EXISTS "idempotency_keys"');
    await queryRunner.query('DROP TABLE IF EXISTS "audit_logs"');
  }
}
