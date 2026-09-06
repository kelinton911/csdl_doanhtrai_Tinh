import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { AssetStatus } from '../dt04.enums';
import { QualityGrade } from '../../../common/enums';

// Cá thể tài sản (Quyển IV §VIII). asset_code UNIQUE toàn hệ thống (BR-DT04-016);
// ACTIVE tại 1 vị trí/1 đơn vị/thời điểm (BR-DT04-007).
@Entity('asset_instance')
export class AssetInstance extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'asset_code', type: 'varchar' })
  assetCode!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'product_revision_id', type: 'uuid', nullable: true })
  productRevisionId!: string | null;

  @Column({ name: 'serial_number', type: 'varchar', nullable: true })
  serialNumber!: string | null;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;

  @Column({ name: 'quality_current', type: 'varchar', nullable: true })
  qualityCurrent!: QualityGrade | null;

  @Column({ type: 'varchar', default: AssetStatus.ACTIVE })
  status!: AssetStatus;

  @Index({ unique: true })
  @Column({ name: 'qr_value', type: 'varchar', nullable: true })
  qrValue!: string | null;
}
