import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ModelStatus } from '../tech.enums';

// Mẫu sản phẩm (Quyển III §VIII). design_symbol (ký hiệu thiết kế) ≠ mã R00 ≠ asset_code
// (BR-DT03-001). Một R00 có thể có nhiều product_model (BR-DT03-002).
@Entity('product_model')
export class ProductModel extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'model_code_internal', type: 'varchar' })
  modelCodeInternal!: string;

  @Column({ name: 'model_name', type: 'varchar' })
  modelName!: string;

  @Column({ name: 'short_name', type: 'varchar', nullable: true })
  shortName!: string | null;

  @Index()
  @Column({ name: 'design_symbol', type: 'varchar', nullable: true })
  designSymbol!: string | null;

  @Column({ name: 'design_year', type: 'varchar', nullable: true })
  designYear!: string | null;

  @Column({ name: 'issuing_authority', type: 'varchar', nullable: true })
  issuingAuthority!: string | null;

  @Column({ name: 'technology_group', type: 'varchar', nullable: true })
  technologyGroup!: string | null;

  @Column({ type: 'varchar', default: ModelStatus.DRAFT })
  status!: ModelStatus;
}
