import { MigrationInterface, QueryRunner } from 'typeorm';

// M04 — Khu đất quốc phòng: hồ sơ + ranh giới (MultiPolygon) + mốc giới + revision bất biến.
export class LandParcels1753000018000 implements MigrationInterface {
  name = 'LandParcels1753000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "land_parcels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "organization_id" uuid,
        "area_id" uuid,
        "barracks_id" uuid,
        "address" varchar,
        "land_area" numeric(14,2) NOT NULL DEFAULT 0,
        "land_use_type" varchar,
        "usage_status" varchar NOT NULL DEFAULT 'IN_USE',
        "legal_status" varchar NOT NULL DEFAULT 'PENDING',
        "legal_origin" varchar,
        "certificate_no" varchar,
        "dispute_status" varchar NOT NULL DEFAULT 'NONE',
        "dispute_note" text,
        "access_road" varchar,
        "has_electricity" boolean NOT NULL DEFAULT false,
        "has_water" boolean NOT NULL DEFAULT false,
        "expansion_capability" varchar,
        "safety_status" varchar,
        "boundary" geometry(MultiPolygon, 4326),
        "location" geometry(Point, 4326),
        "notes" text,
        "workflow_status" varchar NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_land_parcels" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "IDX_land_parcels_code" ON "land_parcels" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_land_parcels_dispute" ON "land_parcels" ("dispute_status")');
    await queryRunner.query('CREATE INDEX "IDX_land_parcels_geom" ON "land_parcels" USING GIST ("boundary")');

    await queryRunner.query(`
      CREATE TABLE "land_parcel_markers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "land_parcel_id" uuid NOT NULL,
        "code" varchar NOT NULL,
        "location" geometry(Point, 4326),
        "note" varchar,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_land_parcel_markers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_land_parcel_marker_code" ON "land_parcel_markers" ("land_parcel_id", "code")',
    );
    await queryRunner.query(
      'ALTER TABLE "land_parcel_markers" ADD CONSTRAINT "FK_marker_parcel" ' +
        'FOREIGN KEY ("land_parcel_id") REFERENCES "land_parcels"("id") ON DELETE CASCADE',
    );

    await queryRunner.query(`
      CREATE TABLE "land_parcel_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "land_parcel_id" uuid NOT NULL,
        "revision_no" integer NOT NULL,
        "payload" jsonb NOT NULL,
        "workflow_status" varchar NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_land_parcel_revisions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "IDX_land_parcel_rev_no" ON "land_parcel_revisions" ("land_parcel_id", "revision_no")',
    );
    await queryRunner.query(
      'ALTER TABLE "land_parcel_revisions" ADD CONSTRAINT "FK_lp_rev_parcel" ' +
        'FOREIGN KEY ("land_parcel_id") REFERENCES "land_parcels"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "land_parcel_revisions"');
    await queryRunner.query('DROP TABLE IF EXISTS "land_parcel_markers"');
    await queryRunner.query('DROP TABLE IF EXISTS "land_parcels"');
  }
}
