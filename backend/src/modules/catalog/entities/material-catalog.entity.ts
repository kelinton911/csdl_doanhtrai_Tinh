import { Column, Entity, Index, Unique } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ActiveStatus } from '../catalog.enums';

// Mã vật chất trong một phiên bản danh mục (Quyển I §VIII). Cây parent-child.
// UNIQUE(version_id, code) — BR-DT01-001 (mã chính thức duy nhất trong 1 phiên bản).
@Entity('material_catalog')
@Unique('UQ_material_catalog_version_code', ['versionId', 'code'])
export class MaterialCatalog extends AbstractEntity {
  @Index()
  @Column({ name: 'version_id', type: 'uuid' })
  versionId!: string;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  // Cây phân loại: trỏ tới material_catalog.id cùng phiên bản (BR-DT01-004/005).
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ name: 'level_no', type: 'int', default: 0 })
  levelNo!: number;

  // ĐVT chuẩn (trỏ tới unit_of_measure.id).
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ name: 'is_leaf', type: 'boolean', default: true })
  isLeaf!: boolean;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ name: 'source_row_no', type: 'int', nullable: true })
  sourceRowNo!: number | null;
}
