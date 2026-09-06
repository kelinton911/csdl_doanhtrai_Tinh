import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AllocationCategory, AllocationSemantics } from '../alloc-rules';
import { ActiveStatus } from '../../catalog/catalog.enums';

// Cấu hình loại phân bổ (Quyển VI §IX). EXCLUSIVE tính vào ràng buộc Σ ≤ HC_ALLOCATABLE.
@Entity('allocation_type')
export class AllocationType extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', default: AllocationSemantics.EXCLUSIVE })
  semantics!: AllocationSemantics;

  @Column({ type: 'varchar', default: AllocationCategory.REGULAR })
  category!: AllocationCategory;

  @Column({ name: 'priority_default', type: 'int', default: 100 })
  priorityDefault!: number;

  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval!: boolean;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}
