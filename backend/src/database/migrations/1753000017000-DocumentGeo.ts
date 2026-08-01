import { MigrationInterface, QueryRunner } from 'typeorm';

// M25 — Ảnh hiện trường: bổ sung toạ độ (lat/lng) và thời điểm chụp cho documents.
export class DocumentGeo1753000017000 implements MigrationInterface {
  name = 'DocumentGeo1753000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents"
        ADD COLUMN IF NOT EXISTS "lat" numeric(9,6),
        ADD COLUMN IF NOT EXISTS "lng" numeric(9,6),
        ADD COLUMN IF NOT EXISTS "captured_at" TIMESTAMPTZ
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents"
        DROP COLUMN IF EXISTS "lat",
        DROP COLUMN IF EXISTS "lng",
        DROP COLUMN IF EXISTS "captured_at"
    `);
  }
}
