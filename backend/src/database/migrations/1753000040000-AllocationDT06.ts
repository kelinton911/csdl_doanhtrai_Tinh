import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-06 — Dự trữ & phân bổ (Quyển VI §IX). 10 bảng, reversible.
export class AllocationDT061753000040000 implements MigrationInterface {
  name = 'AllocationDT061753000040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const abs = `
      "created_by" uuid, "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1`;

    await queryRunner.query(`
      CREATE TABLE "allocation_type" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL, "name" varchar NOT NULL,
        "semantics" varchar NOT NULL DEFAULT 'EXCLUSIVE',
        "category" varchar NOT NULL DEFAULT 'REGULAR',
        "priority_default" int NOT NULL DEFAULT 100,
        "requires_approval" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_allocation_type" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_allocation_type_code" ON "allocation_type" ("code")');

    await queryRunner.query(`
      CREATE TABLE "inventory_allocation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "allocation_no" varchar NOT NULL,
        "allocation_type_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "mission_id" uuid,
        "effective_from" date, "effective_to" date,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        ${abs},
        CONSTRAINT "PK_inventory_allocation" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_allocation_no" ON "inventory_allocation" ("allocation_no")');
    await queryRunner.query('CREATE INDEX "IDX_alloc_type" ON "inventory_allocation" ("allocation_type_id")');
    await queryRunner.query('CREATE INDEX "IDX_alloc_org" ON "inventory_allocation" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_alloc_status" ON "inventory_allocation" ("status")');

    await queryRunner.query(`
      CREATE TABLE "allocation_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "allocation_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL, "lot_id" uuid,
        "quantity" numeric(18,3) NOT NULL, "unit_id" uuid,
        "priority" int NOT NULL DEFAULT 100,
        ${abs},
        CONSTRAINT "PK_allocation_line" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_alloc_line_alloc" ON "allocation_line" ("allocation_id")');

    await queryRunner.query(`
      CREATE TABLE "allocation_hold" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "allocation_id" uuid NOT NULL,
        "allocation_line_id" uuid,
        "category" varchar NOT NULL DEFAULT 'REGULAR',
        "material_catalog_id" uuid NOT NULL, "lot_id" uuid,
        "organization_id" uuid NOT NULL, "mission_id" uuid,
        "quantity_reserved" numeric(18,3) NOT NULL,
        "semantics" varchar NOT NULL DEFAULT 'EXCLUSIVE',
        "priority" int NOT NULL DEFAULT 100,
        "effective_from" date, "effective_to" date,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "basis_document_id" uuid,
        ${abs},
        CONSTRAINT "PK_allocation_hold" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_hold_alloc" ON "allocation_hold" ("allocation_id")');
    await queryRunner.query('CREATE INDEX "IDX_hold_line" ON "allocation_hold" ("allocation_line_id")');
    await queryRunner.query('CREATE INDEX "IDX_hold_category" ON "allocation_hold" ("category")');
    await queryRunner.query('CREATE INDEX "IDX_hold_material" ON "allocation_hold" ("material_catalog_id")');
    await queryRunner.query('CREATE INDEX "IDX_hold_org" ON "allocation_hold" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_hold_status" ON "allocation_hold" ("status")');

    await queryRunner.query(`
      CREATE TABLE "reserve_requirement_link" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "allocation_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "norm_reference" varchar,
        "required_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "allocated_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "gap_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "gap_status" varchar,
        ${abs},
        CONSTRAINT "PK_reserve_requirement_link" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_rrl_alloc" ON "reserve_requirement_link" ("allocation_id")');

    await queryRunner.query(`
      CREATE TABLE "allocation_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_code" varchar NOT NULL,
        "cutoff_time" TIMESTAMPTZ NOT NULL,
        "scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "checksum" varchar,
        "locked" boolean NOT NULL DEFAULT false,
        "locked_at" TIMESTAMPTZ, "locked_by" uuid,
        ${abs},
        CONSTRAINT "PK_allocation_snapshot" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_alloc_snapshot_code" ON "allocation_snapshot" ("snapshot_code")');

    await queryRunner.query(`
      CREATE TABLE "allocation_snapshot_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_id" uuid NOT NULL,
        "allocation_type_code" varchar NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "organization_id" uuid,
        "reserved_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_allocation_snapshot_line" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_alloc_snapline_snap" ON "allocation_snapshot_line" ("snapshot_id")');

    await queryRunner.query(`
      CREATE TABLE "allocation_change_request" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_code" varchar NOT NULL,
        "hold_id" uuid, "from_type_id" uuid, "to_type_id" uuid NOT NULL,
        "quantity" numeric(18,3) NOT NULL,
        "reason" text,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "approved_by" uuid,
        ${abs},
        CONSTRAINT "PK_allocation_change_request" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_alloc_change_code" ON "allocation_change_request" ("request_code")');
    await queryRunner.query('CREATE INDEX "IDX_alloc_change_status" ON "allocation_change_request" ("status")');

    await queryRunner.query(`
      CREATE TABLE "slow_moving_rule" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rule_version" varchar NOT NULL,
        "criteria_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_slow_moving_rule" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_slow_rule_version" ON "slow_moving_rule" ("rule_version")');

    await queryRunner.query(`
      CREATE TABLE "slow_moving_evaluation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rule_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "organization_id" uuid,
        "result_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "evaluated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_slow_moving_evaluation" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_slow_eval_rule" ON "slow_moving_evaluation" ("rule_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of [
      'slow_moving_evaluation', 'slow_moving_rule', 'allocation_change_request',
      'allocation_snapshot_line', 'allocation_snapshot', 'reserve_requirement_link',
      'allocation_hold', 'allocation_line', 'inventory_allocation', 'allocation_type',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
