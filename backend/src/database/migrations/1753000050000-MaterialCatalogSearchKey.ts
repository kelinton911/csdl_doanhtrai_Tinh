import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm cột tìm kiếm không dấu cho material_catalog (phục vụ danh mục Quân nhu Phụ lục I).
// search_key = tên đã chuẩn hóa (bỏ dấu, hạ chữ, gộp khoảng trắng) → gõ không dấu vẫn khớp.
// Dùng GIN pg_trgm để ILIKE '%...%' vẫn nhanh khi danh mục lớn (2762 ITEM). Nullable → dòng cũ không vỡ.
export class MaterialCatalogSearchKey1753000050000 implements MigrationInterface {
  name = 'MaterialCatalogSearchKey1753000050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');
    await queryRunner.query('ALTER TABLE "material_catalog" ADD COLUMN IF NOT EXISTS "search_key" text');
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_material_catalog_search_key" ON "material_catalog" USING gin ("search_key" gin_trgm_ops)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_material_catalog_search_key"');
    await queryRunner.query('ALTER TABLE "material_catalog" DROP COLUMN IF EXISTS "search_key"');
  }
}
