import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Tài liệu / ảnh / hồ sơ pháp lý (M08/UC-12). Tệp lưu ngoài CSDL (MinIO);
// CSDL chỉ giữ metadata + object key + checksum + quyền. Không dùng tên tệp làm định danh.
@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'content_type' })
  contentType!: string;

  @Column({ type: 'bigint', default: 0 })
  size!: string;

  @Column()
  checksum!: string;

  @Column({ name: 'object_key' })
  objectKey!: string;

  // Phân loại/mức độ (ví dụ: minh chứng kiểm kê, bản vẽ, hồ sơ pháp lý).
  @Column({ type: 'varchar', nullable: true })
  classification!: string | null;

  // Liên kết tới thực thể nghiệp vụ (barracks, facility, inspection_sheet, damage_event…).
  @Index()
  @Column({ name: 'entity_type', type: 'varchar', nullable: true })
  entityType!: string | null;

  @Index()
  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
