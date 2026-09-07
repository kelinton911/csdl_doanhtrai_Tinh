import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { NormSourceStatus, NormValueType } from '../norms-rules';

// Định mức vật chất (Quyển VII §VIII). Gắn bộ định mức + vật chất + semantic_param.
// BR-DT07-011: giữ raw_value + đơn vị gốc song song value_numeric.
@Entity('material_norm')
@Index('IDX_material_norm_lookup', ['materialCatalogId', 'semanticParam'])
export class MaterialNorm extends AbstractEntity {
  @Index()
  @Column({ name: 'norm_set_version_id', type: 'uuid' })
  normSetVersionId!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  // Ngữ nghĩa tham số: CONSUMPTION_PREPARATION | CONSUMPTION_COMBAT | POST_COMBAT_REQUIRED | RESERVE_*.
  @Column({ name: 'semantic_param', type: 'varchar' })
  semanticParam!: string;

  @Column({ name: 'value_type', type: 'varchar', default: NormValueType.FIXED })
  valueType!: NormValueType;

  @Column({ name: 'value_numeric', type: 'numeric', precision: 18, scale: 4, nullable: true })
  valueNumeric!: string | null;

  // Giá trị & đơn vị GỐC (giữ nguyên văn để đối chiếu — BR-DT07-011).
  @Column({ name: 'raw_value', type: 'varchar', nullable: true })
  rawValue!: string | null;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ name: 'formula_expr', type: 'text', nullable: true })
  formulaExpr!: string | null;

  // Tình trạng căn cứ: VERIFIED (dùng chính thức) | LEGACY_UNVERIFIED (BR-DT07-026).
  @Index()
  @Column({ name: 'source_status', type: 'varchar', default: NormSourceStatus.LEGACY_UNVERIFIED })
  sourceStatus!: NormSourceStatus;

  // Trích dẫn căn cứ cụ thể cho định mức này (norm_source_reference).
  @Column({ name: 'source_reference_id', type: 'uuid', nullable: true })
  sourceReferenceId!: string | null;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  // Nguồn gốc dòng khi nhập Excel (đối chiếu lô nhập → DRAFT, BR-DT07-026).
  @Column({ name: 'import_batch_id', type: 'uuid', nullable: true })
  importBatchId!: string | null;
}

// Chiều phạm vi của định mức (norm_dimension). Mỗi dòng = 1 ràng buộc bối cảnh.
// Định mức không có dòng nào = định mức TỔNG QUÁT (áp mọi bối cảnh).
@Entity('norm_dimension')
@Index('IDX_norm_dimension_norm', ['materialNormId'])
export class NormDimension extends AbstractEntity {
  @Column({ name: 'material_norm_id', type: 'uuid' })
  materialNormId!: string;

  // MATERIAL | ORG | TERRITORY | MISSION | PHASE | QUALITY | SCALE | TIME.
  @Column({ name: 'dimension_type', type: 'varchar' })
  dimensionType!: string;

  @Column({ name: 'dimension_value', type: 'varchar' })
  dimensionValue!: string;
}
