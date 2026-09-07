import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CatalogVersionStatus } from '../../../common/enums';

// Bộ định mức (Quyển VII §VIII). Gom nhiều material_norm theo một chủ đề/căn cứ.
@Entity('norm_set')
export class NormSet extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'set_code', type: 'varchar' })
  setCode!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}

// Phiên bản bộ định mức. Máy trạng thái §3: DRAFT→VALIDATED→PUBLISHED→SUPERSEDED→ARCHIVED.
// PUBLISHED BẤT BIẾN (BR-DT07-002): sửa → tạo version mới. Gắn văn bản căn cứ.
@Entity('norm_set_version')
export class NormSetVersion extends AbstractEntity {
  @Index()
  @Column({ name: 'norm_set_id', type: 'uuid' })
  normSetId!: string;

  @Column({ name: 'version_label', type: 'varchar' })
  versionLabel!: string;

  // Văn bản căn cứ (normative_document_version). Thiếu → các định mức là LEGACY_UNVERIFIED.
  @Column({ name: 'document_version_id', type: 'uuid', nullable: true })
  documentVersionId!: string | null;

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
