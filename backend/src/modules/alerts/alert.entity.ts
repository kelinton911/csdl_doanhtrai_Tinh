import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AlertStatus } from '../../common/workflow';

// Cảnh báo (M13/UC-18). Có SLA và lịch sử; gom trùng theo (type, entity).
@Entity('alerts')
@Index(['alertType', 'entityId'], { unique: false })
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // FACILITY_POOR | BARRACKS_PENDING | LOW_STOCK | DAMAGE_UNVERIFIED | INVENTORY_VARIANCE
  @Index()
  @Column({ name: 'alert_type' })
  alertType!: string;

  // LOW | MEDIUM | HIGH | CRITICAL
  @Column({ default: 'MEDIUM' })
  severity!: string;

  @Column()
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ name: 'entity_type', type: 'varchar', nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId!: string | null;

  @Index()
  @Column({ type: 'varchar', default: AlertStatus.OPEN })
  status!: AlertStatus;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  resolution!: string | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
