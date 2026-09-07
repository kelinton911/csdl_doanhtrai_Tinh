import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Nút giải thích (Quyển VIII §VIII, BR-DT08-024). Mỗi dòng vật chất truy được TỚI NGUỒN:
// định mức (NORM) → HC snapshot (HC) → dự trữ SSCĐ (RESERVE) → công thức (FORMULA).
@Entity('calculation_trace_node')
@Index('IDX_trace_node_calc', ['materialCalculationId'])
export class CalculationTraceNode extends AbstractEntity {
  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'material_calculation_id', type: 'uuid' })
  materialCalculationId!: string;

  @Column({ name: 'seq', type: 'int', default: 0 })
  seq!: number;

  // NORM | HC | RESERVE | FORMULA.
  @Column({ name: 'step_type', type: 'varchar' })
  stepType!: string;

  // Tham chiếu đầu vào (norm_id, snapshot_id, semantic_param, source_reference…).
  @Column({ name: 'input_refs', type: 'jsonb', default: () => "'{}'::jsonb" })
  inputRefs!: Record<string, unknown>;

  @Column({ name: 'formula', type: 'text', nullable: true })
  formula!: string | null;

  @Column({ name: 'output_value', type: 'numeric', precision: 18, scale: 4, nullable: true })
  outputValue!: string | null;

  @Column({ name: 'note', type: 'text', nullable: true })
  note!: string | null;
}
