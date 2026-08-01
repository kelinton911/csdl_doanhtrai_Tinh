import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M21 — Nhiệm vụ / kế hoạch công tác doanh trại. Giao xuống đơn vị/địa bàn/người; theo dõi
// tiến độ & chỉ tiêu; cây kế hoạch→nhiệm vụ con. Vòng đời qua `status`. Không xóa cứng.
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // PLAN | DECLARATION | INSPECTION_TASK | REPORT | CONSTRUCTION | MAINTENANCE | OTHER.
  @Column({ type: 'varchar', default: 'OTHER' })
  category!: string;

  // LOW | NORMAL | HIGH | URGENT.
  @Column({ type: 'varchar', default: 'NORMAL' })
  priority!: string;

  // Giao việc: đơn vị giao / đơn vị nhận / địa bàn nhận / người nhận.
  @Column({ name: 'assigner_org_id', type: 'uuid', nullable: true })
  assignerOrgId!: string | null;

  @Index()
  @Column({ name: 'assignee_org_id', type: 'uuid', nullable: true })
  assigneeOrgId!: string | null;

  @Index()
  @Column({ name: 'assignee_area_id', type: 'uuid', nullable: true })
  assigneeAreaId!: string | null;

  @Index()
  @Column({ name: 'assignee_user_id', type: 'uuid', nullable: true })
  assigneeUserId!: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ name: 'progress_percent', type: 'int', default: 0 })
  progressPercent!: number;

  // ASSIGNED | IN_PROGRESS | SUBMITTED | COMPLETED | CANCELLED.
  @Index()
  @Column({ type: 'varchar', default: 'ASSIGNED' })
  status!: string;

  // Chỉ tiêu định lượng (nếu có).
  @Column({ name: 'target_value', type: 'numeric', precision: 16, scale: 2, nullable: true })
  targetValue!: string | null;

  @Column({ name: 'target_unit', type: 'varchar', nullable: true })
  targetUnit!: string | null;

  @Column({ name: 'result_value', type: 'numeric', precision: 16, scale: 2, nullable: true })
  resultValue!: string | null;

  // Cây kế hoạch: nhiệm vụ con trỏ về nhiệm vụ cha.
  @Index()
  @Column({ name: 'parent_task_id', type: 'uuid', nullable: true })
  parentTaskId!: string | null;

  // Liên kết mềm tới đối tượng nghiệp vụ (barracks/project/land_parcel…).
  @Column({ name: 'linked_entity_type', type: 'varchar', nullable: true })
  linkedEntityType!: string | null;

  @Column({ name: 'linked_entity_id', type: 'uuid', nullable: true })
  linkedEntityId!: string | null;

  @Column({ name: 'result_note', type: 'text', nullable: true })
  resultNote!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
