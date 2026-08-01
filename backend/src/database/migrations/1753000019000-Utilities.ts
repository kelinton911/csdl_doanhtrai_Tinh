import { MigrationInterface, QueryRunner } from 'typeorm';

// M11 — Điện/Nước/Năng lượng: hệ thống hạ tầng kỹ thuật + kỳ ghi chỉ số/tiêu thụ/chi phí.
export class Utilities1753000019000 implements MigrationInterface {
  name = 'Utilities1753000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "utility_systems" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar NOT NULL,
        "kind" varchar NOT NULL,
        "barracks_id" uuid,
        "area_id" uuid,
        "organization_id" uuid,
        "capacity" numeric(14,2) NOT NULL DEFAULT 0,
        "capacity_unit" varchar,
        "reserve_volume" numeric(14,2) NOT NULL DEFAULT 0,
        "reserve_unit" varchar,
        "fuel_type" varchar,
        "fuel_level" numeric(12,2) NOT NULL DEFAULT 0,
        "autonomy_hours" numeric(8,1) NOT NULL DEFAULT 0,
        "meter_no" varchar,
        "status" varchar NOT NULL DEFAULT 'OPERATIONAL',
        "last_maintenance_at" TIMESTAMPTZ,
        "next_maintenance_at" TIMESTAMPTZ,
        "location" geometry(Point, 4326),
        "notes" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_utility_systems" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_utility_code" ON "utility_systems" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_utility_category" ON "utility_systems" ("category")');
    await queryRunner.query('CREATE INDEX "IDX_utility_status" ON "utility_systems" ("status")');

    await queryRunner.query(`
      CREATE TABLE "utility_readings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "utility_system_id" uuid NOT NULL,
        "reading_date" date NOT NULL,
        "index_value" numeric(14,2),
        "consumption" numeric(14,2),
        "cost" numeric(16,2),
        "note" varchar,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_utility_readings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_utility_reading_sys" ON "utility_readings" ("utility_system_id", "reading_date")');
    await queryRunner.query(
      'ALTER TABLE "utility_readings" ADD CONSTRAINT "FK_reading_system" ' +
        'FOREIGN KEY ("utility_system_id") REFERENCES "utility_systems"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "utility_readings"');
    await queryRunner.query('DROP TABLE IF EXISTS "utility_systems"');
  }
}
