import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Tác vụ xuất báo cáo (M12/UC-20). Báo cáo ghi nguồn + thời điểm chốt; tệp lưu MinIO.
@Entity('report_jobs')
export class ReportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  template!: string;

  // pdf | excel
  @Column()
  format!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  filters!: Record<string, unknown>;

  // QUEUED | COMPLETED | FAILED
  @Column({ default: 'QUEUED' })
  status!: string;

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount!: number;

  @Column({ name: 'object_key', type: 'varchar', nullable: true })
  objectKey!: string | null;

  @Column({ name: 'snapshot_at', type: 'timestamptz', nullable: true })
  snapshotAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
