import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { TechVerificationStatus } from '../tech.enums';

// Thông số kỹ thuật (Quyển III §VIII, BR-DT03-006/007). Giữ raw_value/raw_unit + nguồn;
// chỉ chính thức khi verification_status = VERIFIED.
@Entity('technical_attribute')
export class TechnicalAttribute extends AbstractEntity {
  @Index()
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId!: string;

  @Column({ name: 'attr_name', type: 'varchar' })
  attrName!: string;

  @Column({ name: 'value_numeric', type: 'numeric', precision: 18, scale: 4, nullable: true })
  valueNumeric!: string | null;

  @Column({ name: 'raw_value', type: 'varchar', nullable: true })
  rawValue!: string | null;

  @Column({ name: 'raw_unit', type: 'varchar', nullable: true })
  rawUnit!: string | null;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Index()
  @Column({ name: 'verification_status', type: 'varchar', default: TechVerificationStatus.DRAFT_EXTRACTED })
  verificationStatus!: TechVerificationStatus;

  @Column({ name: 'source_sheet_id', type: 'uuid', nullable: true })
  sourceSheetId!: string | null;
}
