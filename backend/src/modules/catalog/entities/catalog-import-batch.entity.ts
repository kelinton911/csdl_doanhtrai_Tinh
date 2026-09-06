import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ImportBatchStatus } from '../catalog.enums';

// Lô nhập danh mục (Quyển I §VIII) — có file_hash để đối chiếu & chống nhập trùng file.
@Entity('catalog_import_batch')
export class CatalogImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_name', type: 'varchar' })
  fileName!: string;

  @Index()
  @Column({ name: 'file_hash', type: 'varchar' })
  fileHash!: string;

  @Column({ name: 'source_document_id', type: 'uuid', nullable: true })
  sourceDocumentId!: string | null;

  @Column({ name: 'version_code', type: 'varchar', nullable: true })
  versionCode!: string | null;

  @Column({ name: 'imported_by', type: 'uuid', nullable: true })
  importedBy!: string | null;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows!: number;

  @Column({ name: 'valid_rows', type: 'int', default: 0 })
  validRows!: number;

  @Column({ name: 'error_rows', type: 'int', default: 0 })
  errorRows!: number;

  @Column({ type: 'varchar', default: ImportBatchStatus.DRAFT })
  status!: ImportBatchStatus;

  // Dòng dữ liệu staging (chưa dùng cho tới khi validate + publish). Mỗi dòng:
  // { rowNo, code, name, parentCode?, unitCode? }.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rows!: Array<Record<string, unknown>>;

  @CreateDateColumn({ name: 'imported_at', type: 'timestamptz' })
  importedAt!: Date;
}
