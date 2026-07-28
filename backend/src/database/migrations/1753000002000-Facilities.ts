import { MigrationInterface, QueryRunner } from 'typeorm';

// M05 — Facilities: công trình thuộc doanh trại (UC-07).
export class Facilities1753000002000 implements MigrationInterface {
  name = 'Facilities1753000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "facilities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "barracks_id" uuid NOT NULL,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "type" varchar,
        "area" numeric(12,2) NOT NULL DEFAULT 0,
        "declared_capacity" integer NOT NULL DEFAULT 0,
        "build_year" integer,
        "condition" varchar,
        "status" varchar NOT NULL DEFAULT 'IN_USE',
        "location" geometry(Point, 4326),
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_facilities" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_facilities_barracks_code" ON "facilities" ("barracks_id", "code")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_facilities_geom" ON "facilities" USING GIST ("location")',
    );
    await queryRunner.query(
      'ALTER TABLE "facilities" ADD CONSTRAINT "FK_facilities_barracks" ' +
        'FOREIGN KEY ("barracks_id") REFERENCES "barracks"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "facilities"');
  }
}
