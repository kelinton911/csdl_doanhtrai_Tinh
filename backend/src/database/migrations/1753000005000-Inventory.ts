import { MigrationInterface, QueryRunner } from 'typeorm';

// M06 — Inventory: kho, sổ kho (bút toán bất biến), số dư tồn.
export class Inventory1753000005000 implements MigrationInterface {
  name = 'Inventory1753000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "storage_locations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "type" varchar,
        "barracks_id" uuid,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_storage_locations" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_storage_locations_code" ON "storage_locations" ("code")');

    await queryRunner.query(`
      CREATE TABLE "inventory_transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_id" uuid NOT NULL,
        "storage_location_id" uuid NOT NULL,
        "type" varchar NOT NULL,
        "quantity" numeric(18,3) NOT NULL,
        "balance_after" numeric(18,3) NOT NULL,
        "document_ref" varchar,
        "note" varchar,
        "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_transactions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_txn_material" ON "inventory_transactions" ("material_id")');
    await queryRunner.query('CREATE INDEX "IDX_txn_location" ON "inventory_transactions" ("storage_location_id")');

    await queryRunner.query(`
      CREATE TABLE "stock_balances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "material_id" uuid NOT NULL,
        "storage_location_id" uuid NOT NULL,
        "on_hand" numeric(18,3) NOT NULL DEFAULT 0,
        "last_counted" numeric(18,3),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_stock_balances" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_stock_balances_mat_loc" ON "stock_balances" ("material_id", "storage_location_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "stock_balances"');
    await queryRunner.query('DROP TABLE IF EXISTS "inventory_transactions"');
    await queryRunner.query('DROP TABLE IF EXISTS "storage_locations"');
  }
}
