import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { HcStatus, MaterialRuleStatus } from '../calc-rules';

// Kết quả tính cho MỘT vật chất (Quyển VIII §VIII). Lưu RIÊNG TT_GĐCB/TT_GĐCĐ (BR-DT08-020);
// NC âm giữ nguyên dấu (BR-DT08-004); supply_required = max(NC,0) dẫn xuất (BR-DT08-006).
// NO_RULE/CONFLICT/NO_HC_SNAPSHOT → các trị số để NULL (KHÔNG quy 0 — BR-DT08-008).
@Entity('material_calculation')
@Index('IDX_material_calculation_run_mat', ['runId', 'materialCatalogId'])
export class MaterialCalculation extends AbstractEntity {
  @Index()
  @Column({ name: 'run_id', type: 'uuid' })
  runId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  // Giai đoạn khai báo cho dòng (chuỗi các CalcPhase, hoặc COMBINED khi gộp cả hai).
  @Column({ name: 'phase', type: 'varchar', nullable: true })
  phase!: string | null;

  @Column({ name: 'tt_gdcb', type: 'numeric', precision: 18, scale: 4, nullable: true })
  ttGdcb!: string | null;

  @Column({ name: 'tt_gdcd', type: 'numeric', precision: 18, scale: 4, nullable: true })
  ttGdcd!: string | null;

  @Column({ name: 'tt', type: 'numeric', precision: 18, scale: 4, nullable: true })
  tt!: string | null;

  @Column({ name: 'pc_sscd', type: 'numeric', precision: 18, scale: 4, nullable: true })
  pcSscd!: string | null;

  @Column({ name: 'hc', type: 'numeric', precision: 18, scale: 4, nullable: true })
  hc!: string | null;

  @Column({ name: 'nc', type: 'numeric', precision: 18, scale: 4, nullable: true })
  nc!: string | null;

  @Column({ name: 'supply_required', type: 'numeric', precision: 18, scale: 4, nullable: true })
  supplyRequired!: string | null;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  // SELECTED | NO_RULE | CONFLICT — đồng bộ resolve DT-07.
  @Index()
  @Column({ name: 'rule_status', type: 'varchar' })
  ruleStatus!: MaterialRuleStatus;

  // OK | NO_HC_SNAPSHOT — nguồn HC (BR-DT08-021).
  @Column({ name: 'hc_status', type: 'varchar', default: 'OK' })
  hcStatus!: HcStatus;
}
