import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { LotStatus } from '../dt04.enums';

// Lô vật chất (Quyển IV §VIII). Mã lô ≠ mã R00 (SYS-BR-01). Tách/gộp giữ tổng HC (BR-DT04-010).
@Entity('inventory_lot')
export class InventoryLot extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'lot_code', type: 'varchar' })
  lotCode!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'product_revision_id', type: 'uuid', nullable: true })
  productRevisionId!: string | null;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'primary_location_id', type: 'uuid', nullable: true })
  primaryLocationId!: string | null;

  @Column({ name: 'source_id', type: 'uuid', nullable: true })
  sourceId!: string | null;

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate!: string | null;

  @Column({ name: 'manufacture_year', type: 'varchar', nullable: true })
  manufactureYear!: string | null;

  @Column({ type: 'varchar', default: LotStatus.ACTIVE })
  status!: LotStatus;
}
