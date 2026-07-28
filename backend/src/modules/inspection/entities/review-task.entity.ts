import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Nhiệm vụ kiểm duyệt (M07/UC-11). Sinh khi phiếu được gửi duyệt.
@Entity('review_tasks')
export class ReviewTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sheet_id', type: 'uuid' })
  sheetId!: string;

  // PENDING | APPROVED | REVISION_REQUESTED
  @Column({ type: 'varchar', default: 'PENDING' })
  status!: string;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy!: string | null;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId!: string | null;

  @Column({ name: 'decision_note', type: 'varchar', nullable: true })
  decisionNote!: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
