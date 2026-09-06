import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum OutboxStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

// Outbox pattern (Sprint 0 §1 GAP-7): ghi sự kiện miền TRONG CÙNG transaction với
// thay đổi nghiệp vụ, sau đó dispatcher phát ra ngoài (queue/in-process) — bảo đảm
// "đổi trạng thái ⇔ có sự kiện", không mất/không nhân bản. Dùng cho DT-12 refresh,
// DT-06 chặn giảm HC dưới allocation, v.v.
@Entity('outbox_event')
@Index('IDX_outbox_status_occurred', ['status', 'occurredAt'])
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'aggregate_type', type: 'varchar' })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'varchar' })
  aggregateId!: string;

  @Index()
  @Column({ name: 'event_type', type: 'varchar' })
  eventType!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', default: OutboxStatus.PENDING })
  status!: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'correlation_id', type: 'varchar', nullable: true })
  correlationId!: string | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;
}
