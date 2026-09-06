import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { BomItemStatus } from '../tech.enums';

// Dòng BOM (Quyển III §VIII, BR-DT03-005). Giữ raw_name; chưa ánh xạ component → UNMAPPED.
@Entity('bom_item')
export class BomItem extends AbstractEntity {
  @Index()
  @Column({ name: 'bom_header_id', type: 'uuid' })
  bomHeaderId!: string;

  @Column({ name: 'line_no', type: 'int', default: 0 })
  lineNo!: number;

  @Column({ name: 'group_name', type: 'varchar', nullable: true })
  groupName!: string | null;

  @Column({ name: 'component_id', type: 'uuid', nullable: true })
  componentId!: string | null;

  @Column({ name: 'raw_name', type: 'varchar' })
  rawName!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 3, nullable: true })
  quantity!: string | null;

  @Column({ name: 'length_mm', type: 'numeric', precision: 12, scale: 2, nullable: true })
  lengthMm!: string | null;

  @Column({ name: 'width_mm', type: 'numeric', precision: 12, scale: 2, nullable: true })
  widthMm!: string | null;

  @Column({ name: 'thickness_mm', type: 'numeric', precision: 12, scale: 2, nullable: true })
  thicknessMm!: string | null;

  @Index()
  @Column({ type: 'varchar', default: BomItemStatus.UNMAPPED })
  status!: BomItemStatus;
}
