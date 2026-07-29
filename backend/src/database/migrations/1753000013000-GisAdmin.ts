import { MigrationInterface, QueryRunner } from 'typeorm';

// Pha GIS/Hành chính — mở rộng cây hành chính (cấp tỉnh + đặc khu), đưa kho lên bản đồ,
// và thêm lớp điểm quan tâm (POI: trạm/địa danh/sở chỉ huy...). Không sửa migration cũ.
export class GisAdmin1753000013000 implements MigrationInterface {
  name = 'GisAdmin1753000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) administrative_areas: bổ sung cấp (PROVINCE|COMMUNE), liên kết cha, centroid (đặt nhãn), nguồn.
    await queryRunner.query(`
      ALTER TABLE "administrative_areas"
        ADD COLUMN IF NOT EXISTS "level" varchar NOT NULL DEFAULT 'COMMUNE',
        ADD COLUMN IF NOT EXISTS "parent_code" varchar,
        ADD COLUMN IF NOT EXISTS "province_code" varchar,
        ADD COLUMN IF NOT EXISTS "centroid" geometry(Point, 4326),
        ADD COLUMN IF NOT EXISTS "source" varchar
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_areas_level" ON "administrative_areas" ("level")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_areas_province" ON "administrative_areas" ("province_code")',
    );

    // 2) storage_locations: thêm toạ độ điểm để kho lên bản đồ.
    await queryRunner.query(`
      ALTER TABLE "storage_locations"
        ADD COLUMN IF NOT EXISTS "location" geometry(Point, 4326)
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_storage_geom" ON "storage_locations" USING GIST ("location")',
    );

    // 3) map_pois — điểm quan tâm trên bản đồ: TRAM (trạm), DIA_DANH (địa danh), SO_CHI_HUY, CONG...
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "map_pois" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "category" varchar NOT NULL DEFAULT 'DIA_DANH',
        "symbol_code" varchar,
        "area_id" uuid,
        "province_code" varchar,
        "location" geometry(Point, 4326),
        "description" varchar,
        "source" varchar,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_map_pois" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pois_code" ON "map_pois" ("code")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_pois_geom" ON "map_pois" USING GIST ("location")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_pois_category" ON "map_pois" ("category")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "map_pois"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_storage_geom"');
    await queryRunner.query('ALTER TABLE "storage_locations" DROP COLUMN IF EXISTS "location"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_areas_province"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_areas_level"');
    await queryRunner.query(`
      ALTER TABLE "administrative_areas"
        DROP COLUMN IF EXISTS "source",
        DROP COLUMN IF EXISTS "centroid",
        DROP COLUMN IF EXISTS "province_code",
        DROP COLUMN IF EXISTS "parent_code",
        DROP COLUMN IF EXISTS "level"
    `);
  }
}
