import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Chuyển loại phân bổ (Quyển VI §IX, BR-DT06-006). Chuyển sang SSCĐ cần duyệt; atomic; giữ HC.
@Entity('allocation_change_request')
export class AllocationChangeRequest extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'request_code', type: 'varchar' })
  requestCode!: string;

  @Column({ name: 'hold_id', type: 'uuid', nullable: true })
  holdId!: string | null;

  @Column({ name: 'from_type_id', type: 'uuid', nullable: true })
  fromTypeId!: string | null;

  @Column({ name: 'to_type_id', type: 'uuid' })
  toTypeId!: string;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  quantity!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Index()
  @Column({ type: 'varchar', default: 'DRAFT' })
  status!: string; // DRAFT | SUBMITTED | APPROVED | REJECTED

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;
}
