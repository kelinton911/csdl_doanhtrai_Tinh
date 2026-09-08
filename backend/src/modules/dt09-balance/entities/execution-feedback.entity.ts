import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// DT-09 — Phản hồi thực thi: cập nhật delivered_qty (cộng dồn) → recompute gap dòng cân đối.
@Entity('execution_feedback')
export class ExecutionFeedback extends AbstractEntity {
  @Index()
  @Column({ name: 'execution_request_id', type: 'uuid' })
  executionRequestId!: string;

  @Column({ name: 'delivered_qty', type: 'numeric', precision: 18, scale: 3 })
  deliveredQty!: string;

  @Column({ name: 'feedback_note', type: 'text', nullable: true })
  feedbackNote!: string | null;

  @Column({ name: 'fed_back_by', type: 'uuid', nullable: true })
  fedBackBy!: string | null;

  @Column({ name: 'fed_back_at', type: 'timestamptz' })
  fedBackAt!: Date;
}
