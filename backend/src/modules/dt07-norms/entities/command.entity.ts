import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CommandStatus } from '../norms-rules';

// Chỉ lệnh hậu cần (Quyển VII §XV). Vòng đời DRAFT→ISSUED→IN_PROGRESS→COMPLETED (CANCELLED).
@Entity('command')
export class Command extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'command_no', type: 'varchar' })
  commandNo!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ name: 'issuing_authority', type: 'varchar' })
  issuingAuthority!: string;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: string | null;

  @Index()
  @Column({ type: 'varchar', default: CommandStatus.DRAFT })
  status!: CommandStatus;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt!: Date | null;
}

// Phiên bản chỉ lệnh — ISSUED bất biến; sửa → version mới.
@Entity('command_version')
export class CommandVersion extends AbstractEntity {
  @Index()
  @Column({ name: 'command_id', type: 'uuid' })
  commandId!: string;

  @Column({ name: 'version_label', type: 'varchar' })
  versionLabel!: string;

  @Column({ name: 'file_id', type: 'uuid', nullable: true })
  fileId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}

// Yêu cầu vật chất của chỉ lệnh. BR-DT07-031: tham chiếu định mức PUBLISHED tại effective_date.
@Entity('command_requirement')
export class CommandRequirement extends AbstractEntity {
  @Index()
  @Column({ name: 'command_id', type: 'uuid' })
  commandId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'required_qty', type: 'numeric', precision: 18, scale: 3 })
  requiredQty!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ type: 'date', nullable: true })
  deadline!: string | null;

  // Định mức tham chiếu (norm_set_version + material_norm) tại effective_date.
  @Column({ name: 'norm_set_version_id', type: 'uuid', nullable: true })
  normSetVersionId!: string | null;

  @Column({ name: 'material_norm_id', type: 'uuid', nullable: true })
  materialNormId!: string | null;
}

// Phân giao chỉ lệnh cho đơn vị.
@Entity('command_assignment')
export class CommandAssignment extends AbstractEntity {
  @Index()
  @Column({ name: 'requirement_id', type: 'uuid' })
  requirementId!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'allocated_qty', type: 'numeric', precision: 18, scale: 3 })
  allocatedQty!: string;

  @Column({ type: 'date', nullable: true })
  deadline!: string | null;
}

// Tiến độ thực hiện phân giao.
@Entity('command_progress')
export class CommandProgress extends AbstractEntity {
  @Index()
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ name: 'reported_qty', type: 'numeric', precision: 18, scale: 3 })
  reportedQty!: string;

  @Column({ type: 'varchar', default: 'REPORTED' })
  status!: string;

  @Column({ name: 'reported_at', type: 'timestamptz', nullable: true })
  reportedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
