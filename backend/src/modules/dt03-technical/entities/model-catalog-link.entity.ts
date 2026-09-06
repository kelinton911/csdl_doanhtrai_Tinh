import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ActiveStatus } from '../../catalog/catalog.enums';
import { CatalogLinkType } from '../tech.enums';

// Liên kết mẫu ↔ mã R00 (Quyển III §VIII). Nối tới material_catalog của DT-01.
@Entity('model_catalog_link')
export class ModelCatalogLink extends AbstractEntity {
  @Index()
  @Column({ name: 'product_model_id', type: 'uuid' })
  productModelId!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'link_type', type: 'varchar', default: CatalogLinkType.PRIMARY })
  linkType!: CatalogLinkType;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'basis_document_id', type: 'uuid', nullable: true })
  basisDocumentId!: string | null;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}
