import { MigrationInterface, QueryRunner } from 'typeorm';

// Trục A — Khai báo vật chất thời bình (cấp xã / đơn vị trực thuộc Tỉnh).
// 4 bảng: bản khai báo + dòng (theo danh mục chuẩn) + revision bất biến + đề nghị sửa.
// Cột chuẩn AbstractEntity: id, created_by, updated_by, created_at, updated_at, row_version.
export class MaterialDeclaration1753000047000 implements MigrationInterface {
  name = 'MaterialDeclaration1753000047000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    const abstractCols = `
      "created_by" uuid,
      "updated_by" uuid,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "row_version" int NOT NULL DEFAULT 1
    `;

    // ---- material_declarations ----
    await queryRunner.query(`
      CREATE TABLE "material_declarations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "organization_id" uuid,
        "area_id" uuid,
        "storage_location_id" uuid,
        "period_label" varchar,
        "workflow_status" varchar NOT NULL DEFAULT 'DRAFT',
        "note" text,
        "locked_at" TIMESTAMPTZ,
        "locked_by" uuid,
        ${abstractCols},
        CONSTRAINT "PK_material_declarations" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_material_declarations_code" ON "material_declarations" ("code")');
    await queryRunner.query('CREATE INDEX "IDX_material_declarations_org" ON "material_declarations" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_material_declarations_status" ON "material_declarations" ("workflow_status")');

    // ---- material_declaration_lines ----
    await queryRunner.query(`
      CREATE TABLE "material_declaration_lines" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "declaration_id" uuid NOT NULL,
        "material_catalog_id" uuid NOT NULL,
        "alias_used" varchar,
        "unit_id" uuid,
        "reserve_purpose" varchar NOT NULL DEFAULT 'THUONG_XUYEN',
        "quantity" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_1" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_2" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_3" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_4" numeric(18,3) NOT NULL DEFAULT 0,
        "qty_grade_5" numeric(18,3) NOT NULL DEFAULT 0,
        "unit_price" numeric(18,3),
        "note" text,
        "sort_order" int NOT NULL DEFAULT 0,
        ${abstractCols},
        CONSTRAINT "PK_material_declaration_lines" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE INDEX "IDX_mdl_declaration" ON "material_declaration_lines" ("declaration_id")');
    await queryRunner.query('CREATE INDEX "IDX_mdl_material_catalog" ON "material_declaration_lines" ("material_catalog_id")');

    // ---- material_declaration_revisions ----
    await queryRunner.query(`
      CREATE TABLE "material_declaration_revisions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "declaration_id" uuid NOT NULL,
        "revision_no" int NOT NULL,
        "payload" jsonb NOT NULL,
        "workflow_status" varchar NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_material_declaration_revisions" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_mdr_declaration_revno" ON "material_declaration_revisions" ("declaration_id", "revision_no")');

    // ---- declaration_amendment_requests ----
    await queryRunner.query(`
      CREATE TABLE "declaration_amendment_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "request_code" varchar NOT NULL,
        "declaration_id" uuid NOT NULL,
        "organization_id" uuid,
        "requested_changes" text NOT NULL,
        "reason" text NOT NULL,
        "evidence_document_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "status" varchar NOT NULL DEFAULT 'DRAFT',
        "submitted_by" uuid,
        "submitted_at" TIMESTAMPTZ,
        "reviewed_by" uuid,
        "reviewed_at" TIMESTAMPTZ,
        "review_note" text,
        ${abstractCols},
        CONSTRAINT "PK_declaration_amendment_requests" PRIMARY KEY ("id")
      )`);
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_dar_request_code" ON "declaration_amendment_requests" ("request_code")');
    await queryRunner.query('CREATE INDEX "IDX_dar_declaration" ON "declaration_amendment_requests" ("declaration_id")');
    await queryRunner.query('CREATE INDEX "IDX_dar_org" ON "declaration_amendment_requests" ("organization_id")');
    await queryRunner.query('CREATE INDEX "IDX_dar_status" ON "declaration_amendment_requests" ("status")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "declaration_amendment_requests"');
    await queryRunner.query('DROP TABLE IF EXISTS "material_declaration_revisions"');
    await queryRunner.query('DROP TABLE IF EXISTS "material_declaration_lines"');
    await queryRunner.query('DROP TABLE IF EXISTS "material_declarations"');
  }
}
