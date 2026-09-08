import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { FreshnessStatus } from '../dt12.enums';

// Giá trị KPI tại thời điểm (Quyển XII PHẦN VII). value có thể NULL khi nguồn NO_DATA (KHÔNG quy 0).
// lineage_json = mảng nguồn {sourceType, snapshotId/runId, version, checksum} ⇒ mọi metric truy vết được (AC-15).
// source_version chốt phiên bản nguồn đã dùng để tính; so với latest ⇒ freshness (STALE khi nguồn mới hơn).
@Entity('metric_instance')
@Index('IDX_metric_kpi_asof', ['kpiDefinitionId', 'asOfTime'])
export class MetricInstance extends AbstractEntity {
  @Index()
  @Column({ name: 'kpi_definition_id', type: 'uuid' })
  kpiDefinitionId!: string;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  @Index()
  @Column({ name: 'as_of_time', type: 'timestamptz' })
  asOfTime!: Date;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  value!: string | null;

  // Thời điểm/phiên bản của snapshot nguồn (để tính freshness tất định).
  @Column({ name: 'source_as_of', type: 'timestamptz', nullable: true })
  sourceAsOf!: Date | null;

  @Column({ name: 'source_version', type: 'varchar', nullable: true })
  sourceVersion!: string | null;

  @Column({ name: 'lineage_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  lineageJson!: unknown;

  @Column({ name: 'freshness_status', type: 'varchar', default: FreshnessStatus.FRESH })
  freshnessStatus!: FreshnessStatus;

  @Column({ name: 'metric_hash', type: 'varchar' })
  metricHash!: string;

  @Column({ name: 'computed_at', type: 'timestamptz', default: () => 'now()' })
  computedAt!: Date;
}
