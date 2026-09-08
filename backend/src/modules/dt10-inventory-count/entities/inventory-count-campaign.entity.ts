import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CampaignStatus, CountType } from '../dt10.enums';

// Đợt kiểm kê (Quyển X PHẦN VIII). cutoff_time chốt mốc dựng book_snapshot bất biến.
// scope_json: phạm vi đa chiều (org/area/location/nganh). status theo CAMPAIGN_TRANSITIONS.
@Entity('inventory_count_campaign')
export class InventoryCountCampaign extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'campaign_code', type: 'varchar' })
  campaignCode!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ name: 'count_type', type: 'varchar', default: CountType.PERIODIC })
  countType!: CountType;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  // null tới khi thực hiện cutoff (dựng book_snapshot). Sau đó bất biến.
  @Column({ name: 'cutoff_time', type: 'timestamptz', nullable: true })
  cutoffTime!: Date | null;

  @Index()
  @Column({ type: 'varchar', default: CampaignStatus.DRAFT })
  status!: CampaignStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
