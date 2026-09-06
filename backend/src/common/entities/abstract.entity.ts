import {
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Thực thể nền dùng chung cho các bảng nghiệp vụ MỚI (data dictionary Sprint 0 §4):
// id UUID, created/updated + by, row_version cho optimistic lock (SYS-BR-07 phần thời gian
// + chống ghi đè đồng thời). Module cũ giữ nguyên; module mới `extends AbstractEntity`.
export abstract class AbstractEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Optimistic lock: PUT/PATCH gửi If-Match/row_version; lệch → 409 STALE_WRITE.
  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
