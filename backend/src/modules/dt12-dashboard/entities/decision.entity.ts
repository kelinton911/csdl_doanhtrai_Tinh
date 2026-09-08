import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { DecisionSessionStatus } from '../dt12.enums';

// Phiên hỗ trợ quyết định / what-if (Quyển XII PHẦN IX). baseline_json chụp metric hiện trạng lúc mở phiên;
// params_json giữ tham số what-if. CÁCH LY: mọi tính toán chỉ ghi bảng decision_*, KHÔNG ghi ngược vận hành.
@Entity('decision_session')
export class DecisionSession extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'session_code', type: 'varchar' })
  sessionCode!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  // Chụp KPI/semantic hiện trạng (có lineage) tại thời điểm mở phiên — làm mốc so sánh.
  @Column({ name: 'baseline_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  baselineJson!: Record<string, unknown>;

  @Column({ name: 'params_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  paramsJson!: Record<string, unknown>;

  @Column({ type: 'varchar', default: DecisionSessionStatus.DRAFT })
  status!: DecisionSessionStatus;
}

// Phương án (option) trong phiên. params_json = tham số what-if riêng của phương án (cách ly).
@Entity('decision_option')
export class DecisionOption extends AbstractEntity {
  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'option_key', type: 'varchar' })
  optionKey!: string;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ name: 'params_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  paramsJson!: Record<string, unknown>;
}

// Tiêu chí đánh giá (criterion) + trọng số + hướng (HIGHER_BETTER/LOWER_BETTER lưu ở direction dạng chuỗi).
@Entity('decision_criterion')
export class DecisionCriterion extends AbstractEntity {
  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'criterion_key', type: 'varchar' })
  criterionKey!: string;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ type: 'numeric', precision: 8, scale: 4, default: 1 })
  weight!: string;

  // HIGHER_BETTER | LOWER_BETTER — chuẩn hóa điểm trước khi nhân trọng số.
  @Column({ type: 'varchar', default: 'HIGHER_BETTER' })
  direction!: string;
}

// Điểm số của phương án theo từng tiêu chí (raw → normalized → weighted). Sinh ở /score.
@Entity('decision_score')
@Index('IDX_decision_score_opt_crit', ['optionId', 'criterionId'])
export class DecisionScore extends AbstractEntity {
  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'option_id', type: 'uuid' })
  optionId!: string;

  @Column({ name: 'criterion_id', type: 'uuid' })
  criterionId!: string;

  @Column({ name: 'raw_value', type: 'numeric', precision: 18, scale: 4, nullable: true })
  rawValue!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  normalized!: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 6, nullable: true })
  weighted!: string | null;
}

// Ghi quyết định cuối (chọn phương án + lý do). Bất biến sau khi ghi (RECORDED).
@Entity('decision_record')
export class DecisionRecord extends AbstractEntity {
  @Index()
  @Column({ name: 'session_id', type: 'uuid' })
  sessionId!: string;

  @Column({ name: 'chosen_option_id', type: 'uuid', nullable: true })
  chosenOptionId!: string | null;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ name: 'recorded_by', type: 'uuid', nullable: true })
  recordedBy!: string | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;
}
