import { MigrationInterface, QueryRunner } from 'typeorm';

// Pha 1 — dữ liệu lõi: administrative_areas (M02), barracks + revisions (M04).
export class CoreData1753000001000 implements MigrationInterface {
  name = 'CoreData1753000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // M02 — Xã/phường (có geometry MultiPolygon, SRID 4326).
    await queryRunner.query(`
      CREATE TABLE "administrative_areas" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "type" varchar NOT NULL DEFAULT 'COMMUNE',
        "geometry" geometry(MultiPolygon, 4326),
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_administrative_areas" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_areas_code" ON "administrative_areas" ("code")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_areas_geom" ON "administrative_areas" USING GIST ("geometry")',
    );

    // M04 — Doanh trại (điểm đại diện Point, SRID 4326).
    await queryRunner.query(`
      CREATE TABLE "barracks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "organization_id" uuid,
        "area_id" uuid,
        "declared_capacity" integer NOT NULL DEFAULT 0,
        "location" geometry(Point, 4326),
        "workflow_status" varchar NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_barracks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_barracks_code" ON "barracks" ("code")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_barracks_geom" ON "barracks" USING GIST ("location")',
    );

    // Phiên bản hồ sơ doanh trại (bất biến).
    await queryRunner.query(`
      CREATE TABLE "barracks_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "barracks_id" uuid NOT NULL,
        "revision_no" integer NOT NULL,
        "payload" jsonb NOT NULL,
        "workflow_status" varchar NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_barracks_revisions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_barracks_rev_no" ON "barracks_revisions" ("barracks_id", "revision_no")',
    );
    await queryRunner.query(
      'ALTER TABLE "barracks_revisions" ADD CONSTRAINT "FK_barracks_rev_barracks" ' +
        'FOREIGN KEY ("barracks_id") REFERENCES "barracks"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "barracks_revisions"');
    await queryRunner.query('DROP TABLE IF EXISTS "barracks"');
    await queryRunner.query('DROP TABLE IF EXISTS "administrative_areas"');
  }
}
