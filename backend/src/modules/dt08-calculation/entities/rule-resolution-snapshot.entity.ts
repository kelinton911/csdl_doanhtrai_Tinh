import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { MaterialRuleStatus } from '../calc-rules';

// Ảnh chụp kết quả resolve định mức (DT-07) tại thời điểm chạy (Quyển VIII §VIII, BR-DT08-008).
// Lưu norm được chọn + căn cứ + explanation trace để MỌI dòng truy được tới định mức.
@Entity('rule_resolution_snapshot')
export class RuleResolutionSnapshot extends AbstractEntity {
  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Index()
  @Column({ name: 'material_calculation_id', type: 'uuid', nullable: true })
  materialCalculationId!: string | null;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'semantic_param', type: 'varchar' })
  semanticParam!: string;

  @Column({ name: 'resolved_norm_id', type: 'uuid', nullable: true })
  resolvedNormId!: string | null;

  // SELECTED | NO_RULE | CONFLICT.
  @Column({ name: 'status', type: 'varchar' })
  status!: MaterialRuleStatus;

  // Trích dẫn căn cứ dạng văn bản (trang/dòng/phụ lục) khi SELECTED.
  @Column({ name: 'source_reference', type: 'text', nullable: true })
  sourceReference!: string | null;

  // Trace giải thích lựa chọn (trả nguyên từ DT-07 resolve).
  @Column({ name: 'explanation_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  explanationJson!: Record<string, unknown>;
}
