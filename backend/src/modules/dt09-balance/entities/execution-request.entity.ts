import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ExecutionStatus } from '../dt09.enums';

// DT-09 — Yêu cầu thực thi cấp phát cho một dòng cân đối → sinh chứng từ DT-05 (BR-DT09-028).
// dt05_document_id: chứng từ DT-05 tạo ra; delivered_qty cập nhật qua feedback.
@Entity('execution_request')
export class ExecutionRequest extends AbstractEntity {
  @Index()
  @Column({ name: 'balance_line_id', type: 'uuid' })
  balanceLineId!: string;

  @Column({ name: 'requested_qty', type: 'numeric', precision: 18, scale: 3 })
  requestedQty!: string;

  @Column({ name: 'target_org', type: 'uuid', nullable: true })
  targetOrg!: string | null;

  @Index()
  @Column({ type: 'varchar', default: ExecutionStatus.DRAFT })
  status!: ExecutionStatus;

  @Column({ name: 'dt05_document_id', type: 'uuid', nullable: true })
  dt05DocumentId!: string | null;

  @Column({ name: 'delivered_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  deliveredQty!: string;

  @Column({ name: 'feedback_note', type: 'text', nullable: true })
  feedbackNote!: string | null;
}
