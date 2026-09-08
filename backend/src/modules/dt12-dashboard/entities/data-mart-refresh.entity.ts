import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { FactType, FreshnessStatus } from '../dt12.enums';

// Lần refresh Data Mart (Quyển XII PHẦN XI). Ghi khi rebuild 1 fact từ snapshot nguồn; phát sự kiện outbox
// (DATA_MART_REFRESHED) ⇒ refresh là DẪN XUẤT qua outbox, không sửa tay. Dùng cho GET /data-mart/freshness.
@Entity('data_mart_refresh')
@Index('IDX_dm_refresh_fact', ['factType', 'refreshedAt'])
export class DataMartRefresh extends AbstractEntity {
  @Column({ name: 'fact_type', type: 'varchar' })
  factType!: FactType;

  @Column({ name: 'source_ref_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceRefJson!: Record<string, unknown>;

  // Phiên bản nguồn đã nạp (checksum/version/hash) — so với latest để suy freshness.
  @Column({ name: 'source_version', type: 'varchar', nullable: true })
  sourceVersion!: string | null;

  @Column({ name: 'refreshed_at', type: 'timestamptz', default: () => 'now()' })
  refreshedAt!: Date;

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount!: number;

  @Column({ name: 'outbox_event_id', type: 'uuid', nullable: true })
  outboxEventId!: string | null;

  @Column({ name: 'freshness_status', type: 'varchar', default: FreshnessStatus.FRESH })
  freshnessStatus!: FreshnessStatus;
}
