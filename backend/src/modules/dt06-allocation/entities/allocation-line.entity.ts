import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Dòng phân bổ (Quyển VI §IX) — một mục đích cho một vật chất/lô.
@Entity('allocation_line')
export class AllocationLine extends AbstractEntity {
  @Index()
  @Column({ name: 'allocation_id', type: 'uuid' })
  allocationId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  quantity!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ type: 'int', default: 100 })
  priority!: number;
}
