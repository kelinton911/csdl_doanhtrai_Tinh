import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ThresholdDirection } from '../dt12.enums';

// Ngưỡng cảnh báo cho KPI (Quyển XII PHẦN VII). scope_json giới hạn phạm vi áp ngưỡng (rỗng = toàn tỉnh).
// direction quyết định so sánh: HIGHER_WORSE (GAP/NC) hay LOWER_WORSE (HC/HC-AVAILABLE).
@Entity('kpi_threshold')
export class KpiThreshold extends AbstractEntity {
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
}
