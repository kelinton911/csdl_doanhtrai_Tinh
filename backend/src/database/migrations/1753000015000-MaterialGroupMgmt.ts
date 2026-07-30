import { MigrationInterface, QueryRunner } from 'typeorm';

// Quản lý NHÓM VẬT CHẤT (material-category) đúng quy định quân đội.
//
// Bổ sung 3 cột cho bảng danh mục chung `catalogs` để:
//   - `ordinal`     : tách SỐ THỨ TỰ phụ lục ("V", "1", "12") ra khỏi TÊN nhóm.
//                     Tên nhóm chỉ giữ phần chữ ("Cấp nước"); số thứ tự dùng để
//                     hiển thị + sắp xếp mà không lẫn vào tên.
//   - `origin`      : nguồn gốc nhóm — 'BQP' (dẫn xuất Phụ lục 2837/DT-QLDT),
//                     'STANDARD' (ngành hậu cần-kỹ thuật: Quân nhu/Quân y/Xăng dầu/
//                     Vật tư/Kỹ thuật/Doanh trại), 'LOCAL' (đơn vị tự tạo).
//   - `user_edited` : đánh dấu người dùng đã sửa tay tên/mô tả. Seeder BQP sẽ KHÔNG
//                     ghi đè khi cột này = true → chỉnh sửa sống sót qua các lần seed lại.
//
// Cột đặt trên `catalogs` (dùng chung mọi loại danh mục); loại khác để mặc định NULL/false.
export class MaterialGroupMgmt1753000015000 implements MigrationInterface {
  name = 'MaterialGroupMgmt1753000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "ordinal" varchar(16)`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "origin" varchar(12) NOT NULL DEFAULT 'BQP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "catalogs" ADD COLUMN IF NOT EXISTS "user_edited" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "user_edited"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "origin"`);
    await queryRunner.query(`ALTER TABLE "catalogs" DROP COLUMN IF EXISTS "ordinal"`);
  }
}
