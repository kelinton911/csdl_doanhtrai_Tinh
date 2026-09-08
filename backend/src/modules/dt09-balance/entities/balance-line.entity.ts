import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// DT-09 — Dòng cân đối theo vật chất. supply_required COPY từ DT-08 (không tính lại, BR-DT09-009).
// planned_source_qty = Σ giữ chỗ ACTIVE; gap_qty = supply_required − planned_source_qty.
@Entity('balance_line')
export class BalanceLine extends AbstractEntity {
  @Index()
  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  // Bất biến trong phạm vi DT-09 — chỉ nhận từ supplyRequired của run DT-08.
  @Column({ name: 'supply_required', type: 'numeric', precision: 18, scale: 3, default: 0 })
  supplyRequired!: string;

  @Column({ name: 'planned_source_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  plannedSourceQty!: string;

  @Column({ name: 'gap_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  gapQty!: string;

  // OPEN | PARTIAL | COVERED.
  @Column({ type: 'varchar', default: 'OPEN' })
  status!: string;
}
