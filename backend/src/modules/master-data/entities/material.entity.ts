import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Danh mục vật chất/vật tư (M03/UC-07). Một mã chỉ một đơn vị tính chuẩn.
// Không tạo mã trùng; không xóa cứng mã đã dùng — ngừng hiệu lực.
@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Nhóm phân loại (tham chiếu catalogs.type='material-category').
  @Column({ name: 'category_code', type: 'varchar', nullable: true })
  categoryCode!: string | null;

  // Đơn vị tính chuẩn (tham chiếu catalogs.type='unit-of-measure').
  @Column({ name: 'unit_code', type: 'varchar', nullable: true })
  unitCode!: string | null;

  // Quy cách kỹ thuật.
  @Column({ type: 'varchar', nullable: true })
  spec!: string | null;

  // Cấp chất lượng (tham chiếu catalogs.type='quality-grade').
  @Column({ name: 'quality_grade', type: 'varchar', nullable: true })
  qualityGrade!: string | null;

  // Số scale theo đơn vị tính (số lượng lưu numeric, không dùng float).
  @Column({ name: 'default_scale', type: 'int', default: 0 })
  defaultScale!: number;

  // Thuộc tính mở rộng.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes!: Record<string, unknown>;

  // Mã trong TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI (Phụ lục CV 2837/DT-QLDT).
  // Tham chiếu MỀM tới asset_catalog_items.code — cùng quy ước với categoryCode/unitCode,
  // để nạp lại phụ lục bản mới không vướng ràng buộc.
  @Index()
  @Column({ name: 'asset_code', type: 'varchar', nullable: true })
  assetCode!: string | null;

  // UNMAPPED | MAPPED | OUT_OF_SCOPE | PROPOSED
  // OUT_OF_SCOPE dành cho vật chất thuộc ngành khác (Quân nhu, Xăng dầu...) — không có
  // mã trong phụ lục ngành Doanh trại; đánh dấu để không bị nhắc mãi ở màn rà soát.
  @Column({ name: 'asset_code_status', default: 'UNMAPPED' })
  assetCodeStatus!: string;

  // DRAFT | PUBLISHED | INACTIVE
  @Column({ default: 'DRAFT' })
  status!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
