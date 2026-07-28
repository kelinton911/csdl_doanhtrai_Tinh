import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Lô nhập dữ liệu hàng loạt (M14/UC-21). Không ghi trực tiếp dữ liệu chính trước khi xác nhận.
@Entity('import_batches')
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // materials | ... (đối tượng đích)
  @Column()
  target!: string;

  @Column({ type: 'varchar', nullable: true })
  filename!: string | null;

  // STAGED | COMMITTED | FAILED
  @Column({ default: 'STAGED' })
  status!: string;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows!: number;

  @Column({ name: 'valid_rows', type: 'int', default: 0 })
  validRows!: number;

  @Column({ name: 'error_rows', type: 'int', default: 0 })
  errorRows!: number;

  @Column({ name: 'committed_count', type: 'int', default: 0 })
  committedCount!: number;

  // Dữ liệu staging (đã parse) + lỗi theo dòng.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  staging!: Array<Record<string, unknown>>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors!: Array<{ row: number; column?: string; message: string }>;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
