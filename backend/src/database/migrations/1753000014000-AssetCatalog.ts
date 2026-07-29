import { MigrationInterface, QueryRunner } from 'typeorm';

// Pha Danh mục tài sản ngành Doanh trại — nạp TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI
// (Phụ lục kèm Công văn 2837/DT-QLDT ngày 16/7/2026 của Cục Doanh trại/TCHC-KT) làm
// danh mục chính thức. Dữ liệu do BQP sở hữu: chỉ đọc, thay theo từng văn bản, không sửa dòng.
//
// Không FK giữa asset_catalog_items.parent_code và code (tự tham chiếu theo mã) để
// nạp lại bản phụ lục mới trong một transaction mà không vướng ràng buộc.
// materials.asset_code / facilities.asset_code cũng là tham chiếu MỀM, đúng quy ước
// sẵn có của dự án (materials.category_code, materials.unit_code đều là tham chiếu mềm).
export class AssetCatalog1753000014000 implements MigrationInterface {
  name = 'AssetCatalog1753000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) asset_catalog_items — hệ thống bản ghi gốc của Phụ lục (1272 nút, 6 cấp).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_catalog_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar(22) NOT NULL,
        "name" varchar NOT NULL,
        "search_text" varchar NOT NULL DEFAULT '',
        "parent_code" varchar(22),
        "level" smallint NOT NULL DEFAULT 0,
        "path" varchar NOT NULL DEFAULT '',
        "path_names" text NOT NULL DEFAULT '',
        "is_leaf" boolean NOT NULL DEFAULT false,
        "child_count" int NOT NULL DEFAULT 0,
        "unit_raw" varchar,
        "unit_code" varchar,
        "unit_on_group" boolean NOT NULL DEFAULT false,
        "chapter" varchar(6),
        "chapter_name" varchar,
        "domain" varchar(12) NOT NULL DEFAULT 'UNCLASSIFIED',
        "duplicate_group" varchar,
        "source_doc" varchar NOT NULL,
        "source_row" int,
        "source_sha" varchar(64) NOT NULL,
        "revision" varchar NOT NULL,
        "status" varchar NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_asset_catalog_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_aci_code" ON "asset_catalog_items" ("code")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_aci_parent" ON "asset_catalog_items" ("parent_code")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_aci_level" ON "asset_catalog_items" ("level")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_aci_chapter" ON "asset_catalog_items" ("chapter")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_aci_domain" ON "asset_catalog_items" ("domain")',
    );
    // varchar_pattern_ops: cho phép lấy cả cây con bằng path LIKE 'tiền tố%' dùng index,
    // kể cả khi collation của DB không phải C. Không dùng ltree vì dấu '.' trong mã
    // trùng chính dấu phân cách của ltree.
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_aci_path" ON "asset_catalog_items" ("path" varchar_pattern_ops)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_aci_search" ON "asset_catalog_items" ("search_text" varchar_pattern_ops)',
    );

    // 2) Gắn mã quốc gia vào vật chất và công trình. Cột phụ, cho phép NULL —
    // không ảnh hưởng inventory_transactions/stock_balances đang tham chiếu material_id.
    await queryRunner.query(`
      ALTER TABLE "materials"
        ADD COLUMN IF NOT EXISTS "asset_code" varchar,
        ADD COLUMN IF NOT EXISTS "asset_code_status" varchar NOT NULL DEFAULT 'UNMAPPED'
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_materials_asset_code" ON "materials" ("asset_code")',
    );
    await queryRunner.query(`
      ALTER TABLE "facilities"
        ADD COLUMN IF NOT EXISTS "asset_code" varchar,
        ADD COLUMN IF NOT EXISTS "asset_code_status" varchar NOT NULL DEFAULT 'UNMAPPED'
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_facilities_asset_code" ON "facilities" ("asset_code")',
    );

    // 3) Đề xuất bổ sung danh mục (đáp ứng CV 2837/DT-QLDT — hạn 30/8/2026).
    // Mã đề xuất KHÔNG BAO GIỜ ghi vào asset_catalog_items: ranh giới giữa
    // "BQP đã ban hành" và "đơn vị đề xuất" không được nhoè.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_catalog_proposal_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "deadline" date,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "object_key" varchar,
        "row_count" int NOT NULL DEFAULT 0,
        "exported_at" TIMESTAMPTZ,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_acp_batches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_acp_batch_code" ON "asset_catalog_proposal_batches" ("code")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_catalog_proposals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_id" uuid,
        "parent_code" varchar(22) NOT NULL,
        "proposed_code" varchar(22),
        "name" varchar NOT NULL,
        "unit_code" varchar,
        "unit_raw" varchar,
        "justification" text,
        "source_kind" varchar NOT NULL DEFAULT 'MANUAL',
        "source_id" uuid,
        "org_id" uuid,
        "barracks_id" uuid,
        "requires_parent_promotion" boolean NOT NULL DEFAULT false,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "created_by" uuid,
        "updated_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "row_version" int NOT NULL DEFAULT 1,
        CONSTRAINT "PK_acp_proposals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_acp_batch" ON "asset_catalog_proposals" ("batch_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_acp_parent" ON "asset_catalog_proposals" ("parent_code")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_acp_status" ON "asset_catalog_proposals" ("status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "asset_catalog_proposals"');
    await queryRunner.query('DROP TABLE IF EXISTS "asset_catalog_proposal_batches"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_facilities_asset_code"');
    await queryRunner.query(`
      ALTER TABLE "facilities"
        DROP COLUMN IF EXISTS "asset_code_status",
        DROP COLUMN IF EXISTS "asset_code"
    `);
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_materials_asset_code"');
    await queryRunner.query(`
      ALTER TABLE "materials"
        DROP COLUMN IF EXISTS "asset_code_status",
        DROP COLUMN IF EXISTS "asset_code"
    `);

    await queryRunner.query('DROP TABLE IF EXISTS "asset_catalog_items"');
  }
}
