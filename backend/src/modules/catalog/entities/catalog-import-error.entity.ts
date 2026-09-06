import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Lỗi/cảnh báo từng dòng của lô nhập (Quyển I §VIII).
@Entity('catalog_import_error')
export class CatalogImportError {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId!: string;

  @Column({ name: 'row_no', type: 'int' })
  rowNo!: number;

  @Column({ name: 'field_name', type: 'varchar', nullable: true })
  fieldName!: string | null;

  @Column({ name: 'error_code', type: 'varchar' })
  errorCode!: string;

  @Column({ name: 'error_message', type: 'varchar' })
  errorMessage!: string;

  @Column({ name: 'raw_value', type: 'varchar', nullable: true })
  rawValue!: string | null;
}
