import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Lô ghi sổ (Quyển V §X) — posting nguyên tử của một chứng từ. Idempotency-key trùng → 1 batch.
@Entity('posting_batch')
export class PostingBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ name: 'posted_by', type: 'uuid', nullable: true })
  postedBy!: string | null;

  @CreateDateColumn({ name: 'posted_at', type: 'timestamptz' })
  postedAt!: Date;

  @Column({ name: 'movement_count', type: 'int', default: 0 })
  movementCount!: number;

  @Column({ type: 'varchar', nullable: true })
  checksum!: string | null;

  @Column({ type: 'varchar', default: 'POSTED' })
  status!: string;
}
