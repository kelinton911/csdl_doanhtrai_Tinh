import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Bổ nhiệm tài khoản vào chức vụ trong một đơn vị. Một user có thể giữ nhiều chức vụ;
// isPrimary đánh dấu chức vụ chính. Miễn nhiệm = đặt endDate/isActive thay vì xóa cứng.
@Entity('user_positions')
export class UserPosition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ name: 'position_id', type: 'uuid' })
  positionId!: string;

  // Đơn vị bổ nhiệm (tham chiếu organizations). Null = phạm vi tỉnh/hệ thống.
  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'start_date', type: 'timestamptz', default: () => 'now()' })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate!: Date | null;

  @Column({ name: 'is_primary', default: false })
  isPrimary!: boolean;

  // Số/ký hiệu quyết định bổ nhiệm (nếu có).
  @Column({ name: 'appointment_doc', type: 'varchar', nullable: true })
  appointmentDoc!: string | null;

  @Column({ type: 'varchar', nullable: true })
  notes!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
