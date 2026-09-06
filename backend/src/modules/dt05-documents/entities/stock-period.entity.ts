import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { StockPeriodStatus } from '../dt05.enums';

// Kỳ sổ kho + khóa kỳ (Quyển V §X, BR-DT05-010). LOCKED cấm backdate.
@Entity('stock_period')
export class StockPeriod extends AbstractEntity {
  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'period_from', type: 'date' })
  periodFrom!: string;

  @Column({ name: 'period_to', type: 'date' })
  periodTo!: string;

  @Index()
  @Column({ type: 'varchar', default: StockPeriodStatus.OPEN })
  status!: StockPeriodStatus;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'unlock_reason', type: 'text', nullable: true })
  unlockReason!: string | null;
}
