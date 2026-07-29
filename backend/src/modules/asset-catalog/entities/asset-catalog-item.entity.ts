import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Một nút trong TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI.
// Nguồn: Phụ lục kèm Công văn 2837/DT-QLDT ngày 16/7/2026 — Cục Doanh trại/TCHC-KT.
//
// Dữ liệu do BQP sở hữu: CHỈ ĐỌC với người dùng, chỉ thay bằng cách nạp lại phụ lục
// mới qua `npm run seed:asset-catalog`. Không có API sửa/xoá.
// Mã đã ngừng dùng được đánh SUPERSEDED, KHÔNG xoá cứng.
@Entity('asset_catalog_items')
export class AssetCatalogItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Mã vật tư R##.##.##.##.##.### — 6 đoạn, duy nhất toàn danh mục.
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 22 })
  code!: string;

  // Tên NGUYÊN VĂN theo phụ lục, giữ cả tiền tố đánh mục ("1/", "2.4/", "-").
  // Đây là chuỗi được xuất ngược ra file nộp Cục Doanh trại — không chuẩn hoá.
  @Column()
  name!: string;

  // Bản chữ thường + BỎ DẤU của `name`, tính sẵn ở seeder.
  // Cho phép tìm "bom" ra "bơm" mà không cần extension unaccent/pg_trgm.
  @Column({ name: 'search_text', default: '' })
  searchText!: string;

  // Mã cha, suy thuần từ `code` (zero hoá đoạn khác 0 cuối cùng). NULL ở nút gốc.
  // Tự tham chiếu theo mã, KHÔNG FK — để nạp lại phụ lục mới trong một transaction.
  @Index()
  @Column({ name: 'parent_code', type: 'varchar', length: 22, nullable: true })
  parentCode!: string | null;

  // 0 (gốc) .. 6. Bằng vị trí đoạn khác 0 cuối cùng.
  // CẢNH BÁO: KHÔNG dùng level để suy ra chương — chương nằm ở hai độ sâu mã khác nhau
  // (chương I–XIII ở đoạn thứ 3, chương XIV–XVIII ở đoạn đầu). Dùng cột `chapter`.
  @Index()
  @Column({ type: 'smallint', default: 0 })
  level!: number;

  // Đường dẫn mã tổ tiên, phân cách '/'. Lấy cây con: path LIKE '<path nút cha>%'.
  @Column({ default: '' })
  path!: string;

  // Đường dẫn TÊN tổ tiên ("Doanh trại › I/ Đất Quốc phòng › …"), dựng sẵn.
  // BẮT BUỘC trả kèm mọi kết quả tìm kiếm: 121 dòng có tên đúng bằng "Các loại khác",
  // vô nghĩa nếu thiếu ngữ cảnh tổ tiên.
  @Column({ name: 'path_names', type: 'text', default: '' })
  pathNames!: string;

  @Column({ name: 'is_leaf', default: false })
  isLeaf!: boolean;

  @Column({ name: 'child_count', type: 'int', default: 0 })
  childCount!: number;

  // ĐVT NGUYÊN VĂN theo phụ lục ('m2 SD', 'M3', 'cái'...). NULL ở 338 dòng không có ĐVT.
  // Đây là cột được ghi vào file Excel nộp BQP — chuẩn hoá sai cũng không rò ra ngoài.
  @Column({ name: 'unit_raw', type: 'varchar', nullable: true })
  unitRaw!: string | null;

  // Đơn vị tính đã chuẩn hoá (tham chiếu mềm catalogs.type='unit-of-measure').
  @Column({ name: 'unit_code', type: 'varchar', nullable: true })
  unitCode!: string | null;

  // True cho 17 nút VỪA có ĐVT VỪA có con (vd 'R00.00.07.07.00.000' — "7/ Vật tư điện").
  // Khi tổng hợp: cộng lượng CỦA CHÍNH NÚT dọc cây; KHÔNG lấy tổng cha = SUM(con),
  // nếu không sẽ cộng trùng.
  @Column({ name: 'unit_on_group', default: false })
  unitOnGroup!: boolean;

  // Số La Mã I..XVIII (thiếu VI trong phụ lục gốc). Suy bằng DUYỆT NGƯỢC TỔ TIÊN.
  @Index()
  @Column({ type: 'varchar', length: 6, nullable: true })
  chapter!: string | null;

  @Column({ name: 'chapter_name', type: 'varchar', nullable: true })
  chapterName!: string | null;

  // FACILITY (chương I–IV, XVII: đất/nhà/vật kiến trúc) | MATERIAL (chương V, VII–XVI,
  // XVIII: trang thiết bị) | ROOT | UNCLASSIFIED (nút không thuộc chương nào).
  @Index()
  @Column({ type: 'varchar', length: 12, default: 'UNCLASSIFIED' })
  domain!: string;

  // Cảnh báo trùng tên khác nhánh (vd R13.01.* trùng 42 tên với R06.04.01.*).
  // CHỈ để cảnh báo trên giao diện — không dùng để khử trùng, vì khử trùng sẽ
  // làm hỏng khả năng xuất ngược đúng nguyên văn phụ lục.
  @Column({ name: 'duplicate_group', type: 'varchar', nullable: true })
  duplicateGroup!: string | null;

  @Column({ name: 'source_doc' })
  sourceDoc!: string;

  // Số thứ tự trong phụ lục (1..1271). NULL ở nút gốc "Doanh trại".
  @Column({ name: 'source_row', type: 'int', nullable: true })
  sourceRow!: number | null;

  // SHA-256 của file dữ liệu nguồn, đóng trên MỌI dòng.
  // `SELECT DISTINCT source_sha` trả lời ngay "đang nạp bản phụ lục nào".
  @Column({ name: 'source_sha', type: 'varchar', length: 64 })
  sourceSha!: string;

  @Column()
  revision!: string;

  // ACTIVE | SUPERSEDED (nạp bản mới thì mã vắng mặt chuyển SUPERSEDED, không xoá).
  @Column({ default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
