import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ReportInstanceStatus } from '../dt11.enums';

// Bản báo cáo (Quyển XI §VIII). Workflow DRAFT→VALIDATED→APPROVED→ISSUED→SUPERSEDED (BR-DT11-016/017).
// Khi ISSUED: file_object_key + checksum (sha256) BẤT BIẾN. Phát hành lại ⇒ version mới, bản cũ SUPERSEDED
// (superseded_by_id trỏ bản mới), file cũ giữ nguyên (không ghi đè).
@Entity('report_instance')
export class ReportInstance extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'report_code', type: 'varchar' })
  reportCode!: string;

  @Index()
  @Column({ name: 'report_definition_id', type: 'uuid' })
  reportDefinitionId!: string;

  @Column({ name: 'template_version_id', type: 'uuid' })
  templateVersionId!: string;

  @Column({ name: 'dataset_instance_id', type: 'uuid' })
  datasetInstanceId!: string;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  @Index()
  @Column({ type: 'varchar', default: ReportInstanceStatus.DRAFT })
  status!: ReportInstanceStatus;

  @Column({ name: 'version_no', type: 'int', default: 1 })
  versionNo!: number;

  @Column({ name: 'superseded_by_id', type: 'uuid', nullable: true })
  supersededById!: string | null;

  @Column({ name: 'file_object_key', type: 'varchar', nullable: true })
  fileObjectKey!: string | null;

  @Column({ name: 'file_format', type: 'varchar', nullable: true })
  fileFormat!: string | null;

  @Column({ type: 'varchar', nullable: true })
  checksum!: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ name: 'issued_at', type: 'timestamptz', nullable: true })
  issuedAt!: Date | null;
}
