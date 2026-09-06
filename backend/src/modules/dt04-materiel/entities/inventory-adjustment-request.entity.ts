import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AdjustmentStatus } from '../dt04.enums';

// Yêu cầu điều chỉnh số dư (Quyển IV §VIII, BR-DT04-015). Tách người lập/duyệt;
// duyệt → sinh giao dịch ADJUSTMENT (không sửa số dư trực tiếp — SYS-BR-02).
@Entity('inventory_adjustment_request')
export class InventoryAdjustmentRequest extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'request_code', type: 'varchar' })
  requestCode!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;

  @Column({ name: 'before_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  beforeQty!: string;

  @Column({ name: 'proposed_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  proposedQty!: string;

  @Column({ name: 'delta_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  deltaQty!: string;

  @Column({ name: 'reason_code', type: 'varchar' })
  reasonCode!: string;

  @Index()
  @Column({ type: 'varchar', default: AdjustmentStatus.DRAFT })
  status!: AdjustmentStatus;

  @Column({ name: 'requested_by', type: 'uuid', nullable: true })
  requestedBy!: string | null;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  // Giao dịch ADJUSTMENT sinh ra khi duyệt.
  @Column({ name: 'movement_id', type: 'uuid', nullable: true })
  movementId!: string | null;
}
