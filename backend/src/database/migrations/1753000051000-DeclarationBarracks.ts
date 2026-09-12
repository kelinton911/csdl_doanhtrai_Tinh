import { MigrationInterface, QueryRunner } from 'typeorm';

// Gắn bản khai báo vật chất với doanh trại (tùy chọn) để lập & xem theo từng doanh trại.
// Cột nullable + index → không phá dữ liệu cũ.
export class DeclarationBarracks1753000051000 implements MigrationInterface {
  name = 'DeclarationBarracks1753000051000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "material_declarations" ADD COLUMN IF NOT EXISTS "barracks_id" uuid');
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_material_declarations_barracks" ON "material_declarations" ("barracks_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_material_declarations_barracks"');
    await queryRunner.query('ALTER TABLE "material_declarations" DROP COLUMN IF EXISTS "barracks_id"');
  }
}
