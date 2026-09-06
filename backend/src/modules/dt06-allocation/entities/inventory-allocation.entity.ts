import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AllocationStatus } from '../alloc-rules';

// Phân bổ mục đích sử dụng (Quyển VI §IX). Lớp phủ trên HC, không dịch chuyển vật chất.
@Entity('inventory_allocation')
export class InventoryAllocation extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'allocation_no', type: 'varchar' })
  allocationNo!: string;

  @Index()
  @Column({ name: 'allocation_type_id', type: 'uuid' })
  allocationTypeId!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'mission_id', type: 'uuid', nullable: true })
  missionId!: string | null;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Index()
  @Column({ type: 'varchar', default: AllocationStatus.DRAFT })
  status!: AllocationStatus;
}
