import { MigrationInterface, QueryRunner } from 'typeorm';

// RBAC theo Chức vụ–Chức năng (Position–Function): positions, functions, position_functions,
// user_positions, user_permission_grants, permission_conflicts. Khóa mềm (không FK cứng)
// theo phong cách domain hiện có; ràng buộc toàn vẹn xử lý ở tầng service + seed backfill.
export class RbacPositionFunction1753000032000 implements MigrationInterface {
  name = 'RbacPositionFunction1753000032000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----- Chức vụ -----
    await queryRunner.query(`
      CREATE TABLE "positions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" varchar,
        "position_scope" varchar NOT NULL DEFAULT 'UNIT',
        "level" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_positions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_positions_code" ON "positions" ("code")',
    );

    // ----- Chức năng hạt mịn -----
    await queryRunner.query(`
      CREATE TABLE "functions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" varchar,
        "module" varchar NOT NULL,
        "action_type" varchar NOT NULL DEFAULT 'VIEW',
        "is_critical" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_functions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_functions_code" ON "functions" ("code")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_functions_module" ON "functions" ("module")',
    );

    // ----- Ma trận Chức vụ × Chức năng -----
    await queryRunner.query(`
      CREATE TABLE "position_functions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "position_id" uuid NOT NULL,
        "function_id" uuid NOT NULL,
        "scope" varchar NOT NULL DEFAULT 'SELF',
        "conditions" jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_position_functions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_position_function" UNIQUE ("position_id", "function_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_position_functions_position" ON "position_functions" ("position_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_position_functions_function" ON "position_functions" ("function_id")',
    );

    // ----- Bổ nhiệm User × Chức vụ × Đơn vị -----
    await queryRunner.query(`
      CREATE TABLE "user_positions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "position_id" uuid NOT NULL,
        "organization_id" uuid,
        "start_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "end_date" TIMESTAMPTZ,
        "is_primary" boolean NOT NULL DEFAULT false,
        "appointment_doc" varchar,
        "notes" varchar,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_positions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_user_positions_user" ON "user_positions" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_positions_position" ON "user_positions" ("position_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_positions_org" ON "user_positions" ("organization_id")',
    );

    // ----- Cấp quyền lẻ -----
    await queryRunner.query(`
      CREATE TABLE "user_permission_grants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "function_code" varchar NOT NULL,
        "scope" varchar NOT NULL DEFAULT 'SELF',
        "organization_id" uuid,
        "expires_at" TIMESTAMPTZ,
        "reason" varchar,
        "granted_by_id" uuid NOT NULL,
        "granted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "is_revoked" boolean NOT NULL DEFAULT false,
        "revoked_at" TIMESTAMPTZ,
        "revoked_by_id" uuid,
        "revoked_reason" varchar,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_permission_grants" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_user_grants_user" ON "user_permission_grants" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_grants_function" ON "user_permission_grants" ("function_code")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_grants_expires" ON "user_permission_grants" ("expires_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_grants_revoked" ON "user_permission_grants" ("is_revoked")',
    );

    // ----- Xung đột tách biệt trách nhiệm (SoD) -----
    await queryRunner.query(`
      CREATE TABLE "permission_conflicts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "function_code_a" varchar NOT NULL,
        "function_code_b" varchar NOT NULL,
        "description" varchar,
        "severity" varchar NOT NULL DEFAULT 'BLOCK',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permission_conflicts" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permission_conflict_pair" UNIQUE ("function_code_a", "function_code_b")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_perm_conflict_a" ON "permission_conflicts" ("function_code_a")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_perm_conflict_b" ON "permission_conflicts" ("function_code_b")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "permission_conflicts"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_permission_grants"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_positions"');
    await queryRunner.query('DROP TABLE IF EXISTS "position_functions"');
    await queryRunner.query('DROP TABLE IF EXISTS "functions"');
    await queryRunner.query('DROP TABLE IF EXISTS "positions"');
  }
}
