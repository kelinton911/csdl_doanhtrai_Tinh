import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ActiveStatus } from '../../catalog/catalog.enums';
import { TechDocumentType } from '../tech.enums';

// Văn bản/bộ bản vẽ kỹ thuật (Quyển III §VIII). file_hash bất biến — sửa phải tạo
// file/version mới (BR-DT03-005).
@Entity('technical_document')
export class TechnicalDocument extends AbstractEntity {
  @Index()
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId!: string;

  @Column({ name: 'document_type', type: 'varchar', default: TechDocumentType.DRAWING_SET })
  documentType!: TechDocumentType;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId!: string | null;

  @Index()
  @Column({ name: 'file_hash', type: 'varchar', nullable: true })
  fileHash!: string | null;

  @Column({ name: 'source_name', type: 'varchar', nullable: true })
  sourceName!: string | null;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate!: string | null;

  @Column({ name: 'total_sheets', type: 'int', default: 0 })
  totalSheets!: number;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}
