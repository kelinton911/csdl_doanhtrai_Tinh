import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Chi tiết kiểm kê chất lượng theo (vật chất × kho × mục đích dự trữ × vị trí).
// Phân cấp chất lượng Cấp 1–5 của bộ biểu KKDT/03-KK. Tách khỏi stock_balances để không
// ảnh hưởng tồn kho lõi; ghi qua module inspection/import.
@Entity('stock_quality_details')
@Index(
  ['materialId', 'storageLocationId', 'reservePurpose', 'locationClass'],
  { unique: true },
)
export class StockQualityDetail {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @Column({ name: 'storage_location_id', type: 'uuid' })
  storageLocationId!: string;

  // THUONG_XUYEN | SSCD | DOT_XUAT | GOI_DAU | THU_HOI_XU_LY | CHAM_LUAN_CHUYEN (6 loại KKDT).
  @Column({ name: 'reserve_purpose', default: 'THUONG_XUYEN' })
  reservePurpose!: string;

  // DANG_SU_DUNG | KHO_BO_NGANH | KHO_DON_VI (3 cột vị trí của biểu 03/KK).
  @Column({ name: 'location_class', default: 'DANG_SU_DUNG' })
  locationClass!: string;

  @Column({ name: 'qty_grade_1', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade1!: string;

  @Column({ name: 'qty_grade_2', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade2!: string;

  @Column({ name: 'qty_grade_3', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade3!: string;

  @Column({ name: 'qty_grade_4', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade4!: string;

  @Column({ name: 'qty_grade_5', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade5!: string;

  // Đơn giá chốt tại thời điểm kiểm kê (1000đ) — có thể khác materials.unit_price.
  @Column({ name: 'unit_price', type: 'numeric', precision: 18, scale: 3, nullable: true })
  unitPrice!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

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
