import { Column, Entity, Index, Unique } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { RevisionStatus } from '../tech.enums';

// Đời thiết kế (2016/K24…) của một mẫu (Quyển III §VIII). KHÔNG ghi đè: đời mới
// SUPERSEDES đời cũ; tài sản lịch sử giữ liên kết đời cũ (BR-DT03-014).
@Entity('design_revision')
@Unique('UQ_design_revision_model_code', ['productModelId', 'revisionCode'])
export class DesignRevision extends AbstractEntity {
  @Index()
  @Column({ name: 'product_model_id', type: 'uuid' })
  productModelId!: string;

  @Column({ name: 'revision_code', type: 'varchar' })
  revisionCode!: string;

  @Index()
  @Column({ type: 'varchar', default: RevisionStatus.DRAFT })
  status!: RevisionStatus;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'supersedes_revision_id', type: 'uuid', nullable: true })
  supersedesRevisionId!: string | null;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;
}
