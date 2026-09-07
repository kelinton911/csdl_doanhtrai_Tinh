import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// So sánh 2 lần chạy (Quyển VIII §VIII). delta_json = ΔNC theo vật chất + nguyên nhân
// (đổi định mức/HC/dự trữ). Phục vụ SCR-DT08-06.
@Entity('scenario_comparison')
export class ScenarioComparison extends AbstractEntity {
  @Index()
  @Column({ name: 'base_run_id', type: 'uuid' })
  baseRunId!: string;

  @Index()
  @Column({ name: 'target_run_id', type: 'uuid' })
  targetRunId!: string;

  @Column({ name: 'delta_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  deltaJson!: Record<string, unknown>;
}
