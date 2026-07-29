import { MigrationInterface, QueryRunner } from 'typeorm';

// Mở khóa 8 tính năng FE đã hoãn (ADR-2026-07-29):
// - users: mfa_secret (OTP/TOTP), locked_until (khóa tạm sau đăng nhập sai)
// - maintenance_requests: assignee_name (phân công kỹ thuật viên)
// - material_versions: lịch sử phiên bản vật chất (diff)
export class FeatureUnlock1753000012000 implements MigrationInterface {
  name = 'FeatureUnlock1753000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "mfa_secret" varchar`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ`);
    await queryRunner.query(`ALTER TABLE "maintenance_requests" ADD COLUMN IF NOT EXISTS "assignee_name" varchar`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_versions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_id" uuid NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "change_type" varchar NOT NULL,
        "snapshot" jsonb NOT NULL DEFAULT '{}',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_material_versions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_material_versions_material" ON "material_versions" ("material_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "material_versions"');
    await queryRunner.query('ALTER TABLE "maintenance_requests" DROP COLUMN IF EXISTS "assignee_name"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "mfa_secret"');
  }
}
