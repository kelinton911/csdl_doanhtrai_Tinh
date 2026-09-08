import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CountAdjustmentStatus } from '../dt10.enums';

// Yêu cầu điều chỉnh sau kiểm kê (BR-DT10-022, SYS-BR-02). Duyệt → sinh chứng từ DT-05 (CONVERSION),
// KHÔNG sửa số dư trực tiếp. dt05_document_id trỏ tới chứng từ đã POSTED. proposed_qty = số thực đếm.
@Entity('count_adjustment_request')
export class CountAdjustmentRequest extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'request_code', type: 'varchar' })
  requestCode!: string;

  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'variance_id', type: 'uuid', nullable: true })
  varianceId!: string | null;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;

  @Column({ name: 'before_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  beforeQty!: string;

  @Column({ name: 'proposed_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  proposedQty!: string;

  @Column({ name: 'proposed_delta', type: 'numeric', precision: 18, scale: 3, default: 0 })
  proposedDelta!: string;

  @Column({ name: 'reason_code', type: 'varchar' })
  reasonCode!: string;

  @Index()
  @Column({ type: 'varchar', default: CountAdjustmentStatus.DRAFT })
  status!: CountAdjustmentStatus;

  // Chứng từ DT-05 sinh ra khi duyệt (điều chỉnh đi qua DT-05).
  @Column({ name: 'dt05_document_id', type: 'uuid', nullable: true })
  dt05DocumentId!: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;
}
