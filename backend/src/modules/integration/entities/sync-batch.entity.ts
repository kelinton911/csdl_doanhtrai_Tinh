import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Lô đồng bộ offline (M14/UC-22). Server time là chuẩn; xung đột phiên bản không tự ghi đè.
@Entity('sync_batches')
export class SyncBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Idempotency: gửi lại cùng batchKey không tạo dữ liệu trùng.
  @Index({ unique: true })
  @Column({ name: 'batch_key' })
  batchKey!: string;

  @Column({ name: 'client_id', type: 'varchar', nullable: true })
  clientId!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  items!: Array<Record<string, unknown>>;

  // Kết quả từng mục: {localId, status: applied|conflict|failed, serverVersion?, message?}
  @Column({ type: 'jsonb', default: () => "'[]'" })
  results!: Array<Record<string, unknown>>;

  @Column({ default: 'PROCESSED' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
