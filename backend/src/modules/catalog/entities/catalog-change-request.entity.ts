import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ChangeRequestStatus, ChangeRequestType } from '../catalog.enums';

// Đề nghị bổ sung/sửa danh mục (Quyển I §VIII) — đơn vị đề nghị mã mới sau khi đã
// tìm toàn danh mục + alias (SCR-DT01-04). Tách người lập / người duyệt.
@Entity('catalog_change_request')
export class CatalogChangeRequest extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'request_code', type: 'varchar' })
  requestCode!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'request_type', type: 'varchar', default: ChangeRequestType.NEW_MATERIAL })
  requestType!: ChangeRequestType;

  @Column({ name: 'proposed_name', type: 'varchar' })
  proposedName!: string;

  @Column({ name: 'proposed_unit_id', type: 'uuid', nullable: true })
  proposedUnitId!: string | null;

  @Column({ name: 'proposed_parent_id', type: 'uuid', nullable: true })
  proposedParentId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'technical_spec', type: 'jsonb', nullable: true })
  technicalSpec!: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'varchar', default: ChangeRequestStatus.DRAFT })
  status!: ChangeRequestStatus;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;
}
