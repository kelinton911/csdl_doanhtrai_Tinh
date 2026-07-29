import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Lô đề xuất bổ sung gửi Cục Doanh trại/TCHC-KT (một lô = một lần gửi văn bản).
@Entity('asset_catalog_proposal_batches')
export class AssetCatalogProposalBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  title!: string;

  // Hạn nộp theo công văn — CV 2837/DT-QLDT là 30/8/2026.
  @Column({ type: 'date', nullable: true })
  deadline!: string | null;

  // DRAFT | EXPORTED | SENT
  @Column({ default: 'DRAFT' })
  status!: string;

  // Khoá đối tượng của tệp Excel đã xuất trong kho lưu trữ (MinIO).
  @Column({ name: 'object_key', type: 'varchar', nullable: true })
  objectKey!: string | null;

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount!: number;

  @Column({ name: 'exported_at', type: 'timestamptz', nullable: true })
  exportedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
