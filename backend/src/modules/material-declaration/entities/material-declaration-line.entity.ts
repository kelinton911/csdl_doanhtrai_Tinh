import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ReservePurpose } from '../material-declaration.enums';

// Dòng vật chất trong bản khai báo — CHỌN THEO DANH MỤC CHUẨN (material_catalog).
// Số lượng theo cấp chất lượng 1–5 (cùng cách mô hình stock_quality_details).
@Entity('material_declaration_lines')
@Index(['declarationId'])
export class MaterialDeclarationLine extends AbstractEntity {
  @Column({ name: 'declaration_id', type: 'uuid' })
  declarationId!: string;

  // Mã chuẩn DT-01 (material_catalog.id).
  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  // Tên gọi khác (alias) người nhập đã dùng để tra ra mã chuẩn — lưu vết.
  @Column({ name: 'alias_used', type: 'varchar', nullable: true })
  aliasUsed!: string | null;

  // ĐVT (unit_of_measure.id) — mặc định theo catalog nếu bỏ trống.
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ name: 'reserve_purpose', type: 'varchar', default: ReservePurpose.THUONG_XUYEN })
  reservePurpose!: ReservePurpose;

  // Số lượng cuối kỳ (tương thích ngược); service giữ đồng bộ quantity = closingQty.
  @Column({ type: 'numeric', precision: 18, scale: 3, default: 0 })
  quantity!: string;

  // Biến động kỳ (02/KK): cuối kỳ = đầu kỳ + tăng − giảm (đối chiếu cảnh báo, không khóa cứng).
  @Column({ name: 'opening_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  openingQty!: string;

  @Column({ name: 'increase_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  increaseQty!: string;

  @Column({ name: 'decrease_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  decreaseQty!: string;

  @Column({ name: 'closing_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  closingQty!: string;

  // Tách vị trí tồn (02/KK): cuối kỳ = đang dùng + kho Bộ-Ngành + kho đơn vị.
  @Column({ name: 'in_use_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  inUseQty!: string;

  @Column({ name: 'ministry_store_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  ministryStoreQty!: string;

  @Column({ name: 'unit_store_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  unitStoreQty!: string;

  // Giá trị (1000đ) — tùy chọn.
  @Column({ name: 'opening_value', type: 'numeric', precision: 18, scale: 3, nullable: true })
  openingValue!: string | null;

  @Column({ name: 'increase_value', type: 'numeric', precision: 18, scale: 3, nullable: true })
  increaseValue!: string | null;

  @Column({ name: 'decrease_value', type: 'numeric', precision: 18, scale: 3, nullable: true })
  decreaseValue!: string | null;

  @Column({ name: 'closing_value', type: 'numeric', precision: 18, scale: 3, nullable: true })
  closingValue!: string | null;

  // Quy trọng lượng (vật tư quy đổi) — tùy loại.
  @Column({ name: 'converted_weight', type: 'numeric', precision: 18, scale: 3, nullable: true })
  convertedWeight!: string | null;

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

  @Column({ name: 'unit_price', type: 'numeric', precision: 18, scale: 3, nullable: true })
  unitPrice!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
