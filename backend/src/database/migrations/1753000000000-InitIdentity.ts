import { MigrationInterface, QueryRunner } from 'typeorm';

// Migration khởi tạo: bật PostGIS + tạo bảng organizations, users (M01, M02).
// Có chiến lược forward/rollback (Definition of Done).
export class InitIdentity1753000000000 implements MigrationInterface {
  name = 'InitIdentity1753000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ADR-02: PostGIS cho dữ liệu không gian (dùng ở các module GIS sau).
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "type" varchar NOT NULL DEFAULT 'UNIT',
        "parent_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_organizations_code" UNIQUE ("code"),
        CONSTRAINT "PK_organizations" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" varchar NOT NULL,
        "password_hash" varchar NOT NULL,
        "full_name" varchar NOT NULL,
        "roles" text[] NOT NULL DEFAULT '{}',
        "organization_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "failed_attempts" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_users_username" ON "users" ("username")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_username"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
    await queryRunner.query('DROP TABLE IF EXISTS "organizations"');
  }
}
