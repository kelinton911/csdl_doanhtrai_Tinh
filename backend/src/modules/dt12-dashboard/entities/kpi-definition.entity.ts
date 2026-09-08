import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { KpiDefinitionStatus, KpiFormulaVersionStatus, Semantic } from '../dt12.enums';

// Định nghĩa KPI (Quyển XII PHẦN VII). KPI là CẤU HÌNH; mỗi KPI trỏ 1 semantic (semantic_ref) làm nguồn số —
// KHÔNG có "số Dashboard" độc lập (AC-15). current_version_no trỏ formula_version đang hiệu lực.
@Entity('kpi_definition')
export class KpiDefinition extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'kpi_code', type: 'varchar' })
  kpiCode!: string;

  @Column({ type: 'varchar' })
  name!: string;

  // Semantic nguồn (SEM_HC / SEM_HC_AVAILABLE / … / SEM_GAP).
  @Index()
  @Column({ name: 'semantic_ref', type: 'varchar' })
  semanticRef!: Semantic;

  @Column({ type: 'varchar', nullable: true })
  unit!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'varchar', default: KpiDefinitionStatus.DRAFT })
  status!: KpiDefinitionStatus;

  @Column({ name: 'current_version_no', type: 'int', default: 0 })
  currentVersionNo!: number;
}

// Phiên bản công thức KPI (PHẦN VII). formula_expr mô tả cách tổng hợp semantic (mặc định 'SUM(semantic)');
// effective_from/to; ACTIVE = đang dùng để tính metric.
@Entity('kpi_formula_version')
@Index('UQ_kfv_kpi_version', ['kpiDefinitionId', 'versionNo'], { unique: true })
export class KpiFormulaVersion extends AbstractEntity {
  @Index()
  @Column({ name: 'kpi_definition_id', type: 'uuid' })
  kpiDefinitionId!: string;

  @Column({ name: 'version_no', type: 'int' })
  versionNo!: number;

  @Column({ name: 'formula_expr', type: 'text', default: 'SUM(semantic)' })
  formulaExpr!: string;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom!: Date | null;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo!: Date | null;

  @Column({ type: 'varchar', default: KpiFormulaVersionStatus.DRAFT })
  status!: KpiFormulaVersionStatus;
}
