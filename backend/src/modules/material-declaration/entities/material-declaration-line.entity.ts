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

  @Column({ type: 'numeric', precision: 18, scale: 3, default: 0 })
  quantity!: string;

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
