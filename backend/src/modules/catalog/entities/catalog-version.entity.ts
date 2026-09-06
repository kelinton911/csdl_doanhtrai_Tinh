import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CatalogVersionStatus } from '../../../common/enums';

// Phiên bản danh mục chuẩn (Quyển I §VIII). Máy trạng thái §3:
// DRAFT→VALIDATED→PUBLISHED→SUPERSEDED→ARCHIVED. Mọi material_catalog thuộc 1 version.
@Entity('catalog_version')
export class CatalogVersion extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'version_code', type: 'varchar' })
  versionCode!: string;

  @Column({ name: 'version_name', type: 'varchar' })
  versionName!: string;

  @Column({ name: 'source_document_id', type: 'uuid', nullable: true })
  sourceDocumentId!: string | null;

  @Column({ name: 'issued_by', type: 'varchar', nullable: true })
  issuedBy!: string | null;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Index()
  @Column({ type: 'varchar', default: CatalogVersionStatus.DRAFT })
  status!: CatalogVersionStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy!: string | null;
}
