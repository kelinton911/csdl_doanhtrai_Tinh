import { MigrationInterface, QueryRunner } from 'typeorm';

// M17 — Tiềm lực Hậu cần - Kỹ thuật của KHU VỰC cấp xã (dân số/nhân lực, lương thực,
// y tế, xăng dầu, vận tải, cơ sở huy động). Cấp xã tự khai báo theo kỳ; chỉ huy xã duyệt
// (DRAFT → PENDING_REVIEW → APPROVED). Cột chuẩn AbstractEntity.
export class CommunePotential1753000049000 implements MigrationInterface {
  name = 'CommunePotential1753000049000';

  // Các chỉ số định lượng — numeric(18,2) NOT NULL DEFAULT 0.
  private readonly metricCols = [
    'population', 'households', 'labor_force', 'militia_self_defense', 'reserve_force',
    'food_reserve_tons', 'annual_food_output_tons', 'livestock_heads',
    'medical_stations', 'hospital_beds', 'medical_staff',
    'fuel_stations', 'fuel_reserve_m3',
    'trucks', 'passenger_cars', 'boats', 'transport_capacity_tons',
    'civil_warehouses', 'schools', 'factories',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const metrics = this.metricCols
      .map((c) => `"${c}" numeric(18,2) NOT NULL DEFAULT 0`)
      .join(',\n        ');

    await queryRunner.query(`
      CREATE TABLE "commune_potentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "area_id" uuid,
        "organization_id" uuid,
        "period_label" varchar,
        "workflow_status" varchar NOT NULL DEFAULT 'DRAFT',
        ${metrics},
        "assessment" text,
        "note" text,
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_commune_potentials" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_commune_potentials_code" ON "commune_potentials" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_commune_potentials_area" ON "commune_potentials" ("area_id")');
    await queryRunner.query('CREATE INDEX "IDX_commune_potentials_org" ON "commune_potentials" ("organization_id")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "commune_potentials"');
  }
}
