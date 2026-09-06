import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { MovementStatus, MovementType } from '../materiel-rules';

// Sổ cái giao dịch vật chất (Quyển IV §VIII). Bất biến khi POSTED (BR-DT04-004);
// effective_time tách posted_at (BR-DT04-013); chỉ POSTED tác động số dư.
@Entity('materiel_movement')
export class MaterielMovement extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'transaction_no', type: 'varchar' })
  transactionNo!: string;

  @Column({ name: 'transaction_type', type: 'varchar' })
  transactionType!: MovementType;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Index()
  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId!: string | null;

  // Số lượng khai báo (dương) và số lượng có dấu (dẫn xuất) để tính HC nhanh.
  @Column({ type: 'numeric', precision: 18, scale: 3 })
  quantity!: string;

  @Column({ name: 'quantity_signed', type: 'numeric', precision: 18, scale: 3 })
  quantitySigned!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'from_location_id', type: 'uuid', nullable: true })
  fromLocationId!: string | null;

  @Column({ name: 'to_location_id', type: 'uuid', nullable: true })
  toLocationId!: string | null;

  @Column({ name: 'from_org_id', type: 'uuid', nullable: true })
  fromOrgId!: string | null;

  @Column({ name: 'to_org_id', type: 'uuid', nullable: true })
  toOrgId!: string | null;

  @Column({ name: 'document_id', type: 'uuid', nullable: true })
  documentId!: string | null;

  @Index()
  @Column({ name: 'effective_time', type: 'timestamptz' })
  effectiveTime!: Date;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt!: Date | null;

  @Index()
  @Column({ type: 'varchar', default: MovementStatus.DRAFT })
  status!: MovementStatus;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId!: string | null;

  @Column({ name: 'reason_code', type: 'varchar', nullable: true })
  reasonCode!: string | null;
}
