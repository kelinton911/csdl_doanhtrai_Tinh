import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { CalculationScenarioStatus, ENGINE_VERSION } from '../calc-rules';

// Kịch bản tính nhu cầu (Quyển VIII §VIII). DRAFT→CALCULATED→LOCKED; LOCKED bất biến
// (revise = clone, based_on_id + revision_no). scope_json chứa nhiệm vụ/phạm vi + danh
// sách vật chất + tham số quy mô/ngày để engine lặp deterministic.
@Entity('calculation_scenario')
export class CalculationScenario extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'scenario_code', type: 'varchar' })
  scenarioCode!: string;

  @Column({ name: 'name', type: 'varchar' })
  name!: string;

  @Column({ name: 'mission_id', type: 'uuid', nullable: true })
  missionId!: string | null;

  // Phạm vi + tham số tính: { mission?, org?, territory?, phase?, quality?, scale?, time?,
  //   materials: [{ materialCatalogId, unitId?, phases?, scale?, daysPrep?, daysCombat? }] }.
  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  @Column({ name: 'effective_time', type: 'timestamptz' })
  effectiveTime!: Date;

  @Column({ name: 'engine_version', type: 'varchar', default: ENGINE_VERSION })
  engineVersion!: string;

  @Column({ name: 'revision_no', type: 'int', default: 1 })
  revisionNo!: number;

  @Index()
  @Column({ name: 'status', type: 'varchar', default: CalculationScenarioStatus.DRAFT })
  status!: CalculationScenarioStatus;

  // Bản gốc khi clone/revise (BR-DT08-012).
  @Column({ name: 'based_on_id', type: 'uuid', nullable: true })
  basedOnId!: string | null;

  // Tham chiếu snapshot HC (DT-04 materiel_snapshot) — HC lấy as-of, không đọc số dư sống.
  @Column({ name: 'hc_snapshot_id', type: 'uuid', nullable: true })
  hcSnapshotId!: string | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;
}
