import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { QualityGrade } from '../../../common/enums';

// Dòng chứng từ (Quyển V §X). Mỗi dòng sinh 1 movement khi POST.
@Entity('inventory_document_line')
export class InventoryDocumentLine extends AbstractEntity {
  @Index()
  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ name: 'line_no', type: 'int', default: 0 })
  lineNo!: number;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'asset_id', type: 'uuid', nullable: true })
  assetId!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3 })
  quantity!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ name: 'from_location_id', type: 'uuid', nullable: true })
  fromLocationId!: string | null;

  @Column({ name: 'to_location_id', type: 'uuid', nullable: true })
  toLocationId!: string | null;

  @Column({ name: 'quality_grade', type: 'varchar', nullable: true })
  qualityGrade!: QualityGrade | null;

  // Giao dịch DT-04 sinh ra khi POST (truy vết ô biểu → movement → chứng từ).
  @Column({ name: 'movement_id', type: 'uuid', nullable: true })
  movementId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;
}
