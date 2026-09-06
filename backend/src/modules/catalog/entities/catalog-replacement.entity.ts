import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Mã cũ → mã thay thế (Quyển I §VIII, BR-DT01-011) — cảnh báo dùng mã hiện hành.
// Bất biến (chỉ thêm bản ghi thay thế), không cần row_version.
@Entity('catalog_replacement')
export class CatalogReplacement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'old_material_id', type: 'uuid' })
  oldMaterialId!: string;

  @Index()
  @Column({ name: 'new_material_id', type: 'uuid' })
  newMaterialId!: string;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
