import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AllocationCategory, AllocationSemantics, HoldStatus } from '../alloc-rules';

// Khóa nguồn (reservation) theo nhiệm vụ (Quyển VI §IX, BR-DT06-007). semantics denormalized
// từ allocation_type để cưỡng chế Σ EXCLUSIVE ≤ HC_ALLOCATABLE nhanh (BR-DT06-002).
@Entity('allocation_hold')
export class AllocationHold extends AbstractEntity {
  @Index()
  @Column({ name: 'allocation_id', type: 'uuid' })
  allocationId!: string;

  @Index()
  @Column({ name: 'allocation_line_id', type: 'uuid', nullable: true })
  allocationLineId!: string | null;

  // Phân nhóm denormalized (để cấp PC_SSCĐ nhanh — /reserve/sscd).
  @Index()
  @Column({ type: 'varchar', default: AllocationCategory.REGULAR })
  category!: AllocationCategory;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'mission_id', type: 'uuid', nullable: true })
  missionId!: string | null;

  @Column({ name: 'quantity_reserved', type: 'numeric', precision: 18, scale: 3 })
  quantityReserved!: string;

  @Column({ type: 'varchar', default: AllocationSemantics.EXCLUSIVE })
  semantics!: AllocationSemantics;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Index()
  @Column({ type: 'varchar', default: HoldStatus.ACTIVE })
  status!: HoldStatus;

  @Column({ name: 'basis_document_id', type: 'uuid', nullable: true })
  basisDocumentId!: string | null;
}
