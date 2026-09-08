import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { DatasetSourceType } from '../dt11.enums';

// Định nghĩa dataset (Quyển XI §VIII). Lấy từ nguồn snapshot chuẩn theo source_type; field/filter/formula
// tách bảng riêng (cấu hình được). unit_id: ĐVT hiển thị mặc định.
@Entity('dataset_definition')
export class DatasetDefinition extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Index()
  @Column({ name: 'source_type', type: 'varchar' })
  sourceType!: DatasetSourceType;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status!: string;
}

// Ánh xạ trường: field_key hiển thị ← source_path (đường dẫn trong dòng nguồn). data_type để validate schema.
@Entity('dataset_field')
export class DatasetField extends AbstractEntity {
  @Index()
  @Column({ name: 'dataset_definition_id', type: 'uuid' })
  datasetDefinitionId!: string;

  @Column({ name: 'field_key', type: 'varchar' })
  fieldKey!: string;

  @Column({ name: 'source_path', type: 'varchar' })
  sourcePath!: string;

  @Column({ type: 'varchar', nullable: true })
  header!: string | null;

  // number | string | quality_total | value
  @Column({ name: 'data_type', type: 'varchar', default: 'string' })
  dataType!: string;

  @Column({ name: 'order_no', type: 'int', default: 0 })
  orderNo!: number;
}

// Bộ lọc dataset (filter_expr đơn giản: "field op value" hoặc scope key).
@Entity('dataset_filter')
export class DatasetFilter extends AbstractEntity {
  @Index()
  @Column({ name: 'dataset_definition_id', type: 'uuid' })
  datasetDefinitionId!: string;

  @Column({ name: 'filter_key', type: 'varchar' })
  filterKey!: string;

  @Column({ type: 'text' })
  expr!: string;

  @Column({ name: 'order_no', type: 'int', default: 0 })
  orderNo!: number;
}

// Công thức dẫn xuất trên trường đích (formula_expr: biểu thức số học trên các field_key).
@Entity('dataset_formula')
export class DatasetFormula extends AbstractEntity {
  @Index()
  @Column({ name: 'dataset_definition_id', type: 'uuid' })
  datasetDefinitionId!: string;

  @Column({ name: 'target_field', type: 'varchar' })
  targetField!: string;

  @Column({ name: 'formula_expr', type: 'text' })
  formulaExpr!: string;

  @Column({ name: 'order_no', type: 'int', default: 0 })
  orderNo!: number;
}
