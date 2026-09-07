import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Tham chiếu snapshot HC dùng cho lần chạy (Quyển VIII §VIII, BR-DT08-021).
// HC lấy as-of từ DT-04 hc_snapshot — KHÔNG đọc số dư sống. Thiếu → NO_HC_SNAPSHOT.
@Entity('hc_snapshot_ref')
export class HcSnapshotRef extends AbstractEntity {
  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'dt04_snapshot_id', type: 'uuid', nullable: true })
  dt04SnapshotId!: string | null;

  @Column({ name: 'as_of_time', type: 'timestamptz', nullable: true })
  asOfTime!: Date | null;

  @Column({ name: 'scope', type: 'jsonb', default: () => "'{}'::jsonb" })
  scope!: Record<string, unknown>;

  @Column({ name: 'locked', type: 'boolean', default: false })
  locked!: boolean;
}
