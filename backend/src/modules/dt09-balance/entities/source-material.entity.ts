import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// DT-09 — Vật chất khai báo trên một nguồn (declared_qty tại as_of_time). Xác minh & huy động
// nằm ở bảng con (source_verification / mobilization_assessment). snapshot_checksum: chốt số liệu khai báo.
@Entity('source_material')
export class SourceMaterial extends AbstractEntity {
  @Index()
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'declared_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  declaredQty!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  price!: string | null;

  @Column({ name: 'as_of_time', type: 'timestamptz' })
  asOfTime!: Date;

  @Column({ name: 'snapshot_checksum', type: 'varchar', nullable: true })
  snapshotChecksum!: string | null;

  // ACTIVE | INACTIVE.
  @Column({ type: 'varchar', default: 'ACTIVE' })
  status!: string;
}
