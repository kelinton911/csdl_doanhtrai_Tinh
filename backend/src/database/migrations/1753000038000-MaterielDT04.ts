import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-04 — Thực lực vật chất (Quyển IV §VIII). Sổ cái chuẩn + lô/asset + snapshot + điều chỉnh.
export class MaterielDT041753000038000 implements MigrationInterface {
  name = 'MaterielDT041753000038000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const abs = `
      "created_by" uuid, "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1`;

    await queryRunner.query(`
      CREATE TABLE "inventory_lot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lot_code" varchar NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "product_revision_id" uuid,
        "organization_id" uuid NOT NULL,
        "primary_location_id" uuid,
        "source_id" uuid,
        "received_date" date,
        "manufacture_year" varchar,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_inventory_lot" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_inventory_lot_code" ON "inventory_lot" ("lot_code")');
    await queryRunner.query('CREATE INDEX "IDX_lot_material" ON "inventory_lot" ("material_catalog_id")');
    await queryRunner.query('CREATE INDEX "IDX_lot_org" ON "inventory_lot" ("organization_id")');

    await queryRunner.query(`
      CREATE TABLE "asset_instance" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "asset_code" varchar NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid, "product_revision_id" uuid, "serial_number" varchar,
        "organization_id" uuid NOT NULL, "location_id" uuid,
        "quality_current" varchar, "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "qr_value" varchar,
        ${abs},
        CONSTRAINT "PK_asset_instance" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_asset_code" ON "asset_instance" ("asset_code")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_asset_qr" ON "asset_instance" ("qr_value") WHERE "qr_value" IS NOT NULL');
    await queryRunner.query('CREATE INDEX "IDX_asset_material" ON "asset_instance" ("material_catalog_id")');
    await queryRunner.query('CREATE INDEX "IDX_asset_org" ON "asset_instance" ("organization_id")');

    await queryRunner.query(`
      CREATE TABLE "materiel_movement" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "transaction_no" varchar NOT NULL,
        "transaction_type" varchar NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid, "asset_id" uuid,
        "quantity" numeric(18,3) NOT NULL,
        "quantity_signed" numeric(18,3) NOT NULL,
        "organization_id" uuid NOT NULL,
        "from_location_id" uuid, "to_location_id" uuid,
        "from_org_id" uuid, "to_org_id" uuid,
        "document_id" uuid,
        "effective_time" TIMESTAMPTZ NOT NULL,
        "posted_at" TIMESTAMPTZ,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "reversal_of_id" uuid,
        "reason_code" varchar,
        ${abs},
        CONSTRAINT "PK_materiel_movement" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_movement_no" ON "materiel_movement" ("transaction_no")');
    await queryRunner.query('CREATE INDEX "IDX_move_material" ON "materiel_movement" ("material_catalog_id")');
    await queryRunner.query('CREATE INDEX "IDX_move_lot" ON "materiel_movement" ("lot_id")');
    await queryRunner.query('CREATE INDEX "IDX_move_org" ON "materiel_movement" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_move_status" ON "materiel_movement" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_move_eff" ON "materiel_movement" ("effective_time")');

    await queryRunner.query(`
      CREATE TABLE "materiel_snapshot" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_code" varchar NOT NULL,
        "as_of_time" TIMESTAMPTZ NOT NULL,
        "scope" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "checksum" varchar,
        "locked" boolean NOT NULL DEFAULT false,
        "locked_at" TIMESTAMPTZ, "locked_by" uuid,
        ${abs},
        CONSTRAINT "PK_materiel_snapshot" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_snapshot_code" ON "materiel_snapshot" ("snapshot_code")');
    await queryRunner.query('CREATE INDEX "IDX_snapshot_asof" ON "materiel_snapshot" ("as_of_time")');

    await queryRunner.query(`
      CREATE TABLE "materiel_snapshot_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "snapshot_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid, "organization_id" uuid,
        "quantity_on_hand" numeric(18,3) NOT NULL DEFAULT 0,
        "grade1" numeric(18,3) NOT NULL DEFAULT 0,
        "grade2" numeric(18,3) NOT NULL DEFAULT 0,
        "grade3" numeric(18,3) NOT NULL DEFAULT 0,
        "grade4" numeric(18,3) NOT NULL DEFAULT 0,
        "grade5" numeric(18,3) NOT NULL DEFAULT 0,
        "value" numeric(18,2),
        CONSTRAINT "PK_materiel_snapshot_line" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_snapline_snapshot" ON "materiel_snapshot_line" ("snapshot_id")');

    await queryRunner.query(`
      CREATE TABLE "quality_assessment" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lot_id" uuid NOT NULL,
        "assessment_time" TIMESTAMPTZ NOT NULL,
        "grade" varchar NOT NULL,
        "quantity" numeric(18,3) NOT NULL,
        "basis_document_id" uuid, "assessor" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        ${abs},
        CONSTRAINT "PK_quality_assessment" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_quality_lot" ON "quality_assessment" ("lot_id")');

    await queryRunner.query(`
      CREATE TABLE "inventory_adjustment_request" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_code" varchar NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid,
        "organization_id" uuid NOT NULL, "location_id" uuid,
        "before_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "proposed_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "delta_qty" numeric(18,3) NOT NULL DEFAULT 0,
        "reason_code" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "requested_by" uuid, "approved_by" uuid, "movement_id" uuid,
        ${abs},
        CONSTRAINT "PK_inventory_adjustment_request" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_adjustment_code" ON "inventory_adjustment_request" ("request_code")');
    await queryRunner.query('CREATE INDEX "IDX_adjust_material" ON "inventory_adjustment_request" ("material_catalog_id")');
    await queryRunner.query('CREATE INDEX "IDX_adjust_status" ON "inventory_adjustment_request" ("status")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of [
      'inventory_adjustment_request', 'quality_assessment', 'materiel_snapshot_line',
      'materiel_snapshot', 'materiel_movement', 'asset_instance', 'inventory_lot',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
