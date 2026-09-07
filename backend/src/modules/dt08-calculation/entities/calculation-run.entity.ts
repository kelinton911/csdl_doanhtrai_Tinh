import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CalculationRunStatus, ENGINE_VERSION } from '../calc-rules';

// Lần chạy engine (Quyển VIII §VIII). input_hash/output_hash + engine_version cho tái lập
// (BR-DT08-016/017): cùng input_hash + engine_version ⇒ cùng output_hash.
@Entity('calculation_run')
export class CalculationRun extends AbstractEntity {
  @Index()
  @Column({ name: 'scenario_id', type: 'uuid' })
  scenarioId!: string;

  @Column({ name: 'run_no', type: 'int', default: 1 })
  runNo!: number;

  @Index()
  @Column({ name: 'input_hash', type: 'varchar' })
  inputHash!: string;

  @Column({ name: 'output_hash', type: 'varchar', nullable: true })
  outputHash!: string | null;

  @Column({ name: 'engine_version', type: 'varchar', default: ENGINE_VERSION })
  engineVersion!: string;

  @Column({ name: 'status', type: 'varchar', default: CalculationRunStatus.RUNNING })
  status!: CalculationRunStatus;

  @Column({ name: 'line_count', type: 'int', default: 0 })
  lineCount!: number;

  // Số dòng cần xử lý (NO_RULE/CONFLICT/NO_HC_SNAPSHOT) — nổi bật ngoại lệ (SCR-DT08-05).
  @Column({ name: 'exception_count', type: 'int', default: 0 })
  exceptionCount!: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
