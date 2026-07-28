import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Nhật ký truy nguyên (M15/UC-23). Append-only: chỉ INSERT, không sửa/xóa qua ứng dụng.
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;

  @Column({ name: 'actor_name', type: 'varchar', nullable: true })
  actorName!: string | null;

  // Hành động HTTP + nghiệp vụ: ví dụ 'POST /barracks', 'APPROVE'.
  @Index()
  @Column()
  action!: string;

  @Index()
  @Column({ name: 'entity_type', type: 'varchar', nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  method!: string | null;

  @Column({ type: 'varchar', nullable: true })
  path!: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode!: number | null;

  // Tóm tắt trước/sau (che dữ liệu nhạy cảm ở tầng service khi cần).
  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'correlation_id', type: 'varchar', nullable: true })
  correlationId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
