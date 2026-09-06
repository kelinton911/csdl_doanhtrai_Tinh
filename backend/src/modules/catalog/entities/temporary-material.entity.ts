import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { TemporaryMaterialStatus } from '../catalog.enums';

// Mã tạm chờ ánh xạ (Quyển I §VIII, BR-DT01-006). temporary_code CẤM bắt đầu "R00"
// (cưỡng chế ở service qua assertTempCodeNotR00). Ánh xạ TEMP→mã chính thức có audit.
@Entity('temporary_material')
export class TemporaryMaterial extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'temporary_code', type: 'varchar' })
  temporaryCode!: string;

  @Column({ name: 'request_id', type: 'uuid', nullable: true })
  requestId!: string | null;

  @Column({ name: 'display_name', type: 'varchar' })
  displayName!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ name: 'proposed_parent_id', type: 'uuid', nullable: true })
  proposedParentId!: string | null;

  @Index()
  @Column({ type: 'varchar', default: TemporaryMaterialStatus.PENDING_MAPPING })
  status!: TemporaryMaterialStatus;

  @Column({ name: 'official_material_id', type: 'uuid', nullable: true })
  officialMaterialId!: string | null;

  @Column({ name: 'mapped_at', type: 'timestamptz', nullable: true })
  mappedAt!: Date | null;
}
