import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ImportBatchStatus } from '../../catalog/catalog.enums';

// Lô nhập định mức từ Excel (BR-DT07-026). Nhập chỉ tạo material_norm ở trạng thái
// DRAFT (chưa VERIFIED); có file_hash để đối chiếu & chống nhập trùng file.
@Entity('norm_import_batch')
export class NormImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_name', type: 'varchar' })
  fileName!: string;

  @Index()
  @Column({ name: 'file_hash', type: 'varchar' })
  fileHash!: string;

  @Column({ name: 'norm_set_version_id', type: 'uuid', nullable: true })
  normSetVersionId!: string | null;

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

  // Dòng staging: { rowNo, materialCatalogId, semanticParam, valueNumeric, rawValue, unitId }.
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  rows!: Array<Record<string, unknown>>;

  @CreateDateColumn({ name: 'imported_at', type: 'timestamptz' })
  importedAt!: Date;
}
