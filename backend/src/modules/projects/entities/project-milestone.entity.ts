import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// M13 — Nhật ký tiến độ / khối lượng / nghiệm thu / thanh toán của dự án.
// kind: PLAN | PROGRESS | ACCEPTANCE | PAYMENT | ISSUE.
@Entity('project_milestones')
@Index(['projectId', 'milestoneDate'])
export class ProjectMilestone {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column()
  title!: string;

  @Column({ name: 'milestone_date', type: 'date' })
  milestoneDate!: string;

  @Column({ default: 'PROGRESS' })
  kind!: string;

  // Tiến độ tại mốc (%) — dùng cho kind=PROGRESS.
  @Column({ name: 'progress_percent', type: 'int', nullable: true })
  progressPercent!: number | null;

  // Số tiền (VND) — dùng cho kind=PAYMENT (giải ngân/thanh toán).
  @Column({ type: 'numeric', precision: 16, scale: 2, nullable: true })
  amount!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
