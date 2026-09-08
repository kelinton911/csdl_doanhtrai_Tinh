import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Dataset biểu kiểm kê (BR-DT10-025 — cấp cho DT-11). Gắn snapshot_version của official_snapshot;
// dataset_hash chốt nội dung để DT-11 tái lập/đối chiếu. form_code ∈ KK_FORM_CODES.
@Entity('report_dataset')
export class ReportDataset extends AbstractEntity {
  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'form_code', type: 'varchar' })
  formCode!: string;

  @Column({ name: 'snapshot_version', type: 'int' })
  snapshotVersion!: number;

  @Column({ name: 'dataset_hash', type: 'varchar' })
  datasetHash!: string;

  @Column({ name: 'payload_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  payloadJson!: unknown;
}
