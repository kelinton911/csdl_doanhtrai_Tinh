import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ActiveStatus } from '../../catalog/catalog.enums';

// Tờ bản vẽ (Quyển III §VIII) — một technical_document là bộ nhiều tờ.
@Entity('drawing_sheet')
export class DrawingSheet extends AbstractEntity {
  @Index()
  @Column({ name: 'technical_document_id', type: 'uuid' })
  technicalDocumentId!: string;

  @Column({ name: 'sheet_no', type: 'varchar' })
  sheetNo!: string;

  @Column({ name: 'sheet_title', type: 'varchar', nullable: true })
  sheetTitle!: string | null;

  @Column({ name: 'sheet_type', type: 'varchar', nullable: true })
  sheetType!: string | null;

  @Column({ name: 'scale_text', type: 'varchar', nullable: true })
  scaleText!: string | null;

  @Column({ name: 'source_page', type: 'int', nullable: true })
  sourcePage!: number | null;

  @Column({ name: 'preview_file_id', type: 'uuid', nullable: true })
  previewFileId!: string | null;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}
