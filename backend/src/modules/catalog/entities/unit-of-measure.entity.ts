import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ActiveStatus, UnitType } from '../catalog.enums';

// Đơn vị tính chuẩn độc lập (Quyển I §VIII) — chuẩn hóa ký hiệu, kiểm tra vật chất tham chiếu.
@Entity('unit_of_measure')
export class UnitOfMeasure extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  symbol!: string | null;

  @Column({ name: 'unit_type', type: 'varchar', default: UnitType.COUNT })
  unitType!: UnitType;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}
