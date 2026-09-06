import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Snapshot thực lực tại thời điểm (Quyển IV §VIII). LOCKED bất biến (BR-DT04-011).
@Entity('materiel_snapshot')
export class MaterielSnapshot extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'snapshot_code', type: 'varchar' })
  snapshotCode!: string;

  @Index()
  @Column({ name: 'as_of_time', type: 'timestamptz' })
  asOfTime!: Date;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  scope!: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  checksum!: string | null;

  @Column({ type: 'boolean', default: false })
  locked!: boolean;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;
}
