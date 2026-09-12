import { MigrationInterface, QueryRunner } from 'typeorm';

// Mở rộng material_declaration_lines theo đặc tả 02/KK:
//   - Biến động kỳ: đầu kỳ / tăng / giảm / cuối kỳ (số lượng + giá trị).
//   - Tách vị trí tồn: đang dùng / kho Bộ-Ngành / kho đơn vị.
//   - Quy trọng lượng (converted_weight) cho vật tư quy đổi.
// Cột mới đều nullable/default 0 → KHÔNG phá dữ liệu dòng cũ. `quantity` cũ giữ nguyên và được
// service đồng bộ = closing_qty (tương thích ngược cho report/aggregate đang đọc `quantity`).
export class ExtendDeclarationLines1753000048000 implements MigrationInterface {
  name = 'ExtendDeclarationLines1753000048000';

  private readonly cols: Array<{ name: string; nullable: boolean }> = [
    { name: 'opening_qty', nullable: false },
    { name: 'increase_qty', nullable: false },
    { name: 'decrease_qty', nullable: false },
    { name: 'closing_qty', nullable: false },
    { name: 'in_use_qty', nullable: false },
    { name: 'ministry_store_qty', nullable: false },
    { name: 'unit_store_qty', nullable: false },
    { name: 'opening_value', nullable: true },
    { name: 'increase_value', nullable: true },
    { name: 'decrease_value', nullable: true },
    { name: 'closing_value', nullable: true },
    { name: 'converted_weight', nullable: true },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const c of this.cols) {
      const def = c.nullable ? 'numeric(18,3)' : 'numeric(18,3) NOT NULL DEFAULT 0';
      await queryRunner.query(
        `ALTER TABLE "material_declaration_lines" ADD COLUMN IF NOT EXISTS "${c.name}" ${def}`,
      );
    }
    // Khởi tạo closing_qty từ quantity cũ để dữ liệu đã có nhất quán.
    await queryRunner.query(
      `UPDATE "material_declaration_lines" SET "closing_qty" = "quantity" WHERE "closing_qty" = 0 AND "quantity" <> 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const c of [...this.cols].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "material_declaration_lines" DROP COLUMN IF EXISTS "${c.name}"`,
      );
    }
  }
}
