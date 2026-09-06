import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Liên kết dự trữ ↔ định mức DT-07 (Quyển VI §IX, BR-DT06-008/009). gap = required − allocated.
@Entity('reserve_requirement_link')
export class ReserveRequirementLink extends AbstractEntity {
  @Index()
  @Column({ name: 'allocation_id', type: 'uuid' })
  allocationId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  // Tham chiếu norm DT-07 (chưa ràng buộc FK cứng cho tới khi DT-07 mở).
  @Column({ name: 'norm_reference', type: 'varchar', nullable: true })
  normReference!: string | null;

  @Column({ name: 'required_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  requiredQty!: string;

  @Column({ name: 'allocated_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  allocatedQty!: string;

  @Column({ name: 'gap_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  gapQty!: string;

  @Column({ name: 'gap_status', type: 'varchar', nullable: true })
  gapStatus!: string | null;
}
