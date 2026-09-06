import { MigrationInterface, QueryRunner } from 'typeorm';

// DT-05 — Chứng từ nhập/xuất/điều chuyển (Quyển V §X). 5 bảng, reversible.
export class DocumentsDT051753000039000 implements MigrationInterface {
  name = 'DocumentsDT051753000039000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    const abs = `
      "created_by" uuid, "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1`;

    await queryRunner.query(`
      CREATE TABLE "inventory_document" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_no" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "organization_id" uuid NOT NULL,
        "counterparty_org_id" uuid,
        "basis_document_id" uuid,
        "effective_date" date NOT NULL,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "posted_at" TIMESTAMPTZ,
        "posting_batch_id" uuid,
        "reversal_of_id" uuid,
        ${abs},
        CONSTRAINT "PK_inventory_document" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_inv_document_no" ON "inventory_document" ("document_no")');
    await queryRunner.query('CREATE INDEX "IDX_inv_doc_org" ON "inventory_document" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_inv_doc_status" ON "inventory_document" ("status")');
    await queryRunner.query('CREATE INDEX "IDX_inv_doc_eff" ON "inventory_document" ("effective_date")');

    await queryRunner.query(`
      CREATE TABLE "inventory_document_line" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "line_no" int NOT NULL DEFAULT 0,
        "material_catalog_id" uuid NOT NULL,
        "lot_id" uuid, "asset_id" uuid,
        "quantity" numeric(18,3) NOT NULL,
        "unit_id" uuid,
        "from_location_id" uuid, "to_location_id" uuid,
        "quality_grade" varchar,
        "movement_id" uuid,
        "note" varchar,
        ${abs},
        CONSTRAINT "PK_inventory_document_line" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_inv_line_doc" ON "inventory_document_line" ("document_id")');

    await queryRunner.query(`
      CREATE TABLE "posting_batch" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "posted_by" uuid,
        "posted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "movement_count" int NOT NULL DEFAULT 0,
        "checksum" varchar,
        "status" varchar NOT NULL DEFAULT 'POSTED',
        CONSTRAINT "PK_posting_batch" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_posting_batch_doc" ON "posting_batch" ("document_id")');

    await queryRunner.query(`
      CREATE TABLE "transfer_order" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "order_no" varchar NOT NULL,
        "from_org" uuid NOT NULL, "to_org" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL, "lot_id" uuid,
        "dispatched_qty" numeric(18,3), "received_qty" numeric(18,3),
        "dispatched_at" TIMESTAMPTZ, "received_at" TIMESTAMPTZ,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "dispatch_document_id" uuid, "receive_document_id" uuid,
        "discrepancy_note" text,
        ${abs},
        CONSTRAINT "PK_transfer_order" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_transfer_order_no" ON "transfer_order" ("order_no")');
    await queryRunner.query('CREATE INDEX "IDX_transfer_from" ON "transfer_order" ("from_org")');
    await queryRunner.query('CREATE INDEX "IDX_transfer_to" ON "transfer_order" ("to_org")');
    await queryRunner.query('CREATE INDEX "IDX_transfer_status" ON "transfer_order" ("status")');

    await queryRunner.query(`
      CREATE TABLE "stock_period" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "period_from" date NOT NULL, "period_to" date NOT NULL,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "locked_by" uuid, "locked_at" TIMESTAMPTZ, "unlock_reason" text,
        ${abs},
        CONSTRAINT "PK_stock_period" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_stock_period_org" ON "stock_period" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_stock_period_status" ON "stock_period" ("status")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of ['stock_period', 'transfer_order', 'posting_batch', 'inventory_document_line', 'inventory_document']) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
