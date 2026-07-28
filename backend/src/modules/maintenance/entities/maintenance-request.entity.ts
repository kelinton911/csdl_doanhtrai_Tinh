import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { MaintenanceStatus } from '../../../common/workflow';

// Yêu cầu sửa chữa/bảo trì/khôi phục (M09/UC-14).
// Kinh phí lưu numeric (đồng), không dùng float; thay đổi sau duyệt phải tạo điều chỉnh.
@Entity('maintenance_requests')
export class MaintenanceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  title!: string;

  @Index()
  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId!: string | null;

  @Column({ name: 'damage_event_id', type: 'uuid', nullable: true })
  damageEventId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  scope!: string | null;

  // LOW | NORMAL | HIGH | URGENT
  @Column({ default: 'NORMAL' })
  priority!: string;

  @Column({ name: 'estimated_cost', type: 'numeric', precision: 18, scale: 0, default: 0 })
  estimatedCost!: string;

  @Column({ name: 'planned_days', type: 'int', default: 0 })
  plannedDays!: number;

  @Column({ type: 'varchar', default: MaintenanceStatus.DRAFT })
  status!: MaintenanceStatus;

  @Column({ name: 'acceptance_note', type: 'varchar', nullable: true })
  acceptanceNote!: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
