import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { VarianceStatus, VarianceType } from '../dt10.enums';

// Chênh lệch Book ↔ Physical (BR-DT10-013..015). Sinh khi đối chiếu; đóng bằng resolveVariance
// hoặc điều chỉnh → DT-05. variance_qty = physical − book (dấu: âm=thiếu, dương=thừa).
@Entity('count_variance')
export class CountVariance extends AbstractEntity {
  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'book_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  bookQty!: string;

  @Column({ name: 'physical_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  physicalQty!: string;

  @Column({ name: 'variance_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  varianceQty!: string;

  @Column({ name: 'variance_type', type: 'varchar' })
  varianceType!: VarianceType;

  @Index()
  @Column({ type: 'varchar', default: VarianceStatus.OPEN })
  status!: VarianceStatus;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;
}
