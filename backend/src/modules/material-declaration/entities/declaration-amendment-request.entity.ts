import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { WorkflowStatus } from '../../../common/workflow';

// Đề nghị cấp trên cho SỬA bản khai báo ĐÃ DUYỆT (APPROVED). Nêu rõ nội dung cần sửa,
// lý do, kèm minh chứng (documents). Cấp trên duyệt → mở khóa bản khai báo về
// CHANGES_REQUESTED để đơn vị tự sửa rồi trình duyệt lại (giữ vết, tách người lập/duyệt).
@Entity('declaration_amendment_requests')
export class DeclarationAmendmentRequest extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'request_code', type: 'varchar' })
  requestCode!: string;

  @Index()
  @Column({ name: 'declaration_id', type: 'uuid' })
  declarationId!: string;

  // Đơn vị đề nghị — KHÓA phạm vi dữ liệu (SYS-BR-08).
  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // Sửa nội dung gì (mô tả tự do — trường/dòng/giá trị cần chỉnh).
  @Column({ name: 'requested_changes', type: 'text' })
  requestedChanges!: string;

  // Lý do sửa (bắt buộc).
  @Column({ type: 'text' })
  reason!: string;

  // Minh chứng: mảng documents.id (upload trước qua /documents/files).
  @Column({ name: 'evidence_document_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  evidenceDocumentIds!: string[];

  @Index()
  @Column({ type: 'varchar', default: WorkflowStatus.DRAFT })
  status!: WorkflowStatus;

  @Column({ name: 'submitted_by', type: 'uuid', nullable: true })
  submittedBy!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote!: string | null;
}
