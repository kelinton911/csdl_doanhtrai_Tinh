import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { NormConflictStatus } from '../norms-rules';
import { ActiveStatus } from '../../catalog/catalog.enums';

// Định nghĩa ngữ nghĩa tham số tính toán (calculation_parameter) — nguồn cho DT-08.
// Chuẩn hóa semantic_param dùng ở material_norm để DT-08 hiểu đúng ngữ nghĩa.
@Entity('calculation_parameter')
export class CalculationParameter extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'semantic_param', type: 'varchar' })
  semanticParam!: string;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}

// Cấu hình bộ chọn định mức (norm_selector_config) — chiến lược + thứ tự tách đồng ưu tiên.
@Entity('norm_selector_config')
export class NormSelectorConfig extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'config_code', type: 'varchar' })
  configCode!: string;

  @Column({ type: 'varchar', default: 'MOST_SPECIFIC' })
  strategy!: string;

  // Thứ tự chiều dùng tách khi đồng độ đặc thù (jsonb mảng DimensionType).
  @Column({ name: 'tie_break_order', type: 'jsonb', default: () => "'[]'::jsonb" })
  tieBreakOrder!: string[];

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}

// Bảng xếp hạng cơ quan ban hành CÓ VERSION (authority_rank_version). BR-DT07-027:
// thay đổi hạng KHÔNG hồi tố kết quả đã chốt. rank_json: { authority: rank (số nhỏ = ưu tiên cao) }.
@Entity('authority_rank_version')
export class AuthorityRankVersion extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'version_label', type: 'varchar' })
  versionLabel!: string;

  @Column({ name: 'rank_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  rankJson!: Record<string, number>;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;
}

// Ca xung đột định mức (norm_conflict_case). BR-DT07-008: không tự chọn khi ngang ưu tiên.
@Entity('norm_conflict_case')
export class NormConflictCase extends AbstractEntity {
  @Index()
  @Column({ name: 'resolve_request_hash', type: 'varchar' })
  resolveRequestHash!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'semantic_param', type: 'varchar' })
  semanticParam!: string;

  @Column({ name: 'candidate_norm_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  candidateNormIds!: string[];

  @Column({ name: 'request_scope', type: 'jsonb', default: () => "'{}'::jsonb" })
  requestScope!: Record<string, unknown>;

  @Index()
  @Column({ type: 'varchar', default: NormConflictStatus.OPEN })
  status!: NormConflictStatus;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;

  // Định mức được chọn khi giải quyết thủ công (không tự chọn).
  @Column({ name: 'resolved_norm_id', type: 'uuid', nullable: true })
  resolvedNormId!: string | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
