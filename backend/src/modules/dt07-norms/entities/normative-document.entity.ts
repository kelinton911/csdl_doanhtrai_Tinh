import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CatalogVersionStatus } from '../../../common/enums';

// Văn bản căn cứ pháp lý (Quyển VII §VIII). Mỗi định mức phải gắn văn bản căn cứ:
// không có căn cứ → LEGACY_UNVERIFIED, không dùng chính thức (BR-DT07-026).
@Entity('normative_document')
export class NormativeDocument extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'doc_no', type: 'varchar' })
  docNo!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ name: 'issuing_authority', type: 'varchar' })
  issuingAuthority!: string;

  @Column({ name: 'issue_date', type: 'date', nullable: true })
  issueDate!: string | null;
}

// Phiên bản văn bản căn cứ — có file_hash để đối chiếu bất biến (SYS-BR-03).
@Entity('normative_document_version')
export class NormativeDocumentVersion extends AbstractEntity {
  @Index()
  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ name: 'version_label', type: 'varchar' })
  versionLabel!: string;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId!: string | null;

  @Index()
  @Column({ name: 'file_hash', type: 'varchar', nullable: true })
  fileHash!: string | null;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Index()
  @Column({ type: 'varchar', default: CatalogVersionStatus.DRAFT })
  status!: CatalogVersionStatus;
}

// Trích dẫn căn cứ trong 1 phiên bản văn bản (trang/dòng/nội dung trích/mã phụ lục).
@Entity('norm_source_reference')
export class NormSourceReference extends AbstractEntity {
  @Index()
  @Column({ name: 'document_version_id', type: 'uuid' })
  documentVersionId!: string;

  @Column({ name: 'page_no', type: 'int', nullable: true })
  pageNo!: number | null;

  @Column({ name: 'line_ref', type: 'varchar', nullable: true })
  lineRef!: string | null;

  @Column({ name: 'quote_text', type: 'text', nullable: true })
  quoteText!: string | null;

  @Column({ name: 'appendix_code', type: 'varchar', nullable: true })
  appendixCode!: string | null;
}
