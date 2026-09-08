import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ReportDefinitionStatus, TemplateVersionStatus } from '../dt11.enums';

// Định nghĩa biểu (BR-DT11-004/019) — biểu là CẤU HÌNH, KHÔNG hard-code số lượng trong code.
// form_code khóa tự nhiên (01/KK, 01/KKDT, 01/KK-ĐQP…). current_version_no trỏ template đang hiệu lực.
@Entity('report_definition')
export class ReportDefinition extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'form_code', type: 'varchar' })
  formCode!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar', nullable: true })
  category!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'varchar', default: ReportDefinitionStatus.DRAFT })
  status!: ReportDefinitionStatus;

  @Column({ name: 'current_version_no', type: 'int', default: 0 })
  currentVersionNo!: number;
}

// Phiên bản template/layout của một biểu. layout_schema_json giữ cột/section/aggregate + tham chiếu
// dataset_definition. Hiệu lực effective_from/to; PUBLISHED = đang dùng để phát hành.
@Entity('report_template_version')
@Index('UQ_rtv_def_version', ['reportDefinitionId', 'versionNo'], { unique: true })
export class ReportTemplateVersion extends AbstractEntity {
  @Index()
  @Column({ name: 'report_definition_id', type: 'uuid' })
  reportDefinitionId!: string;

  @Column({ name: 'version_no', type: 'int' })
  versionNo!: number;

  // { datasetDefinitionCode?, columns:[{key,header,align?,agg?}], sections?, unitLabel? }
  @Column({ name: 'layout_schema_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  layoutSchemaJson!: Record<string, unknown>;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom!: Date | null;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo!: Date | null;

  @Column({ type: 'varchar', default: TemplateVersionStatus.DRAFT })
  status!: TemplateVersionStatus;
}
