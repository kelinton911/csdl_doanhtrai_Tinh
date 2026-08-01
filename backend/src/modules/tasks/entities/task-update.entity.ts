import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// M21 — Nhật ký cập nhật nhiệm vụ: tiến độ, trao đổi, chuyển trạng thái.
// kind: PROGRESS | COMMENT | STATUS.
@Entity('task_updates')
@Index(['taskId', 'createdAt'])
export class TaskUpdate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id', type: 'uuid' })
  taskId!: string;

  @Column({ default: 'PROGRESS' })
  kind!: string;

  @Column({ name: 'progress_percent', type: 'int', nullable: true })
  progressPercent!: number | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
