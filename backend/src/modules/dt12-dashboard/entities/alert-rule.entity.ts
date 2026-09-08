import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AlertInstanceStatus, AlertSeverity, KpiDefinitionStatus, ThresholdDirection } from '../dt12.enums';

// Quy tắc cảnh báo cấu hình (Quyển XII PHẦN VIII). Gắn 1 KPI + ngưỡng warn/critical + hướng + SLA giờ.
// Mở rộng nền `alerts` cũ (M13) nhưng CẤU HÌNH được (không hard-code trong code).
@Entity('alert_rule')
export class AlertRule extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'rule_code', type: 'varchar' })
  ruleCode!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Index()
  @Column({ name: 'kpi_definition_id', type: 'uuid' })
  kpiDefinitionId!: string;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  @Column({ name: 'warn_level', type: 'numeric', precision: 18, scale: 4, nullable: true })
  warnLevel!: string | null;

  @Column({ name: 'critical_level', type: 'numeric', precision: 18, scale: 4, nullable: true })
  criticalLevel!: string | null;

  @Column({ type: 'varchar', default: ThresholdDirection.HIGHER_WORSE })
  direction!: ThresholdDirection;

  @Column({ name: 'sla_hours', type: 'int', default: 72 })
  slaHours!: number;

  @Column({ type: 'varchar', default: KpiDefinitionStatus.ACTIVE })
  status!: KpiDefinitionStatus;
}

// Cảnh báo phát sinh (lifecycle OPEN→ACK→RESOLVED + SLA due_at). dedupe_key gom trùng: cùng rule+scope+severity
// đang OPEN/ACK ⇒ không nhân đôi (BR — đơn vị chưa xử lý ≠ tạo mới).
@Entity('alert_instance')
@Index('IDX_alert_instance_dedupe', ['ruleId', 'dedupeKey', 'status'])
export class AlertInstance extends AbstractEntity {
  @Index()
  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId!: string;

  @Column({ name: 'kpi_definition_id', type: 'uuid' })
  kpiDefinitionId!: string;

  @Column({ name: 'metric_instance_id', type: 'uuid', nullable: true })
  metricInstanceId!: string | null;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  @Column({ name: 'as_of_time', type: 'timestamptz' })
  asOfTime!: Date;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  value!: string | null;

  @Column({ type: 'varchar' })
  severity!: AlertSeverity;

  @Index()
  @Column({ type: 'varchar', default: AlertInstanceStatus.OPEN })
  status!: AlertInstanceStatus;

  @Column({ name: 'dedupe_key', type: 'varchar' })
  dedupeKey!: string;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ name: 'acked_at', type: 'timestamptz', nullable: true })
  ackedAt!: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  resolution!: string | null;
}

// Giao việc xử lý cảnh báo (assignee + thời điểm). Append theo lần assign để giữ lịch sử.
@Entity('alert_assignment')
export class AlertAssignment extends AbstractEntity {
  @Index()
  @Column({ name: 'alert_instance_id', type: 'uuid' })
  alertInstanceId!: string;

  @Column({ name: 'assignee_id', type: 'uuid' })
  assigneeId!: string;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'now()' })
  assignedAt!: Date;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
