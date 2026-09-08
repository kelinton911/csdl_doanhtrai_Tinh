import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { BalancePlanStatus } from '../dt09.enums';

// DT-09 — Kế hoạch cân đối. Nhận supply_required từ 1 lần chạy DT-08 (scenario_run_id), KHÔNG
// tính lại NC (BR-DT09-009). revise = clone (based_on_id, revision_no) nhất quán BR-DT08-011/012.
// LOCKED bất biến; checksum + source_fingerprint chốt tại phê duyệt (BR-DT09-020).
@Entity('balance_plan')
export class BalancePlan extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'plan_code', type: 'varchar' })
  planCode!: string;

  @Column({ type: 'varchar' })
  name!: string;

  // Lần chạy DT-08 (calculation_run) cấp supply_required.
  @Index()
  @Column({ name: 'scenario_run_id', type: 'uuid' })
  scenarioRunId!: string;

  @Index()
  @Column({ type: 'varchar', default: BalancePlanStatus.DRAFT })
  status!: BalancePlanStatus;

  @Column({ name: 'revision_no', type: 'int', default: 1 })
  revisionNo!: number;

  @Column({ name: 'based_on_id', type: 'uuid', nullable: true })
  basedOnId!: string | null;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  // Bản sao output_hash của run DT-08 để truy vết nguồn số liệu NC.
  @Column({ name: 'source_output_hash', type: 'varchar', nullable: true })
  sourceOutputHash!: string | null;

  // Deadline cân đối (lead_time ≤ deadline mới ELIGIBLE). Ngày; null = không ràng buộc.
  @Column({ name: 'deadline_days', type: 'int', nullable: true })
  deadlineDays!: number | null;

  @Column({ type: 'varchar', nullable: true })
  checksum!: string | null;

  @Column({ name: 'source_fingerprint', type: 'varchar', nullable: true })
  sourceFingerprint!: string | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;
}
