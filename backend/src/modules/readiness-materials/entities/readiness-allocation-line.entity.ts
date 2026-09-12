import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Dòng phân cấp lượng của một phương án SSCĐ: mỗi vật chất được phân bổ lượng theo 4 cấp
// (kho Tỉnh / xã / trung đoàn địa phương / căn cứ). qtyTotal = tổng 4 cấp.
@Entity('readiness_allocation_lines')
@Index(['planId'])
export class ReadinessAllocationLine extends AbstractEntity {
  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  // Mã chuẩn (material_catalog.id).
  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ name: 'qty_kho_tinh', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyKhoTinh!: string;

  @Column({ name: 'qty_xa', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyXa!: string;

  @Column({ name: 'qty_trung_doan', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyTrungDoan!: string;

  @Column({ name: 'qty_can_cu', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyCanCu!: string;

  @Column({ name: 'qty_total', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyTotal!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
