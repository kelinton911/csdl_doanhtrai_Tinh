import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Quy tắc chậm luân chuyển có version (Quyển VI §IX, BR-DT06-012/027) — overlay, không đổi HC.
@Entity('slow_moving_rule')
export class SlowMovingRule extends AbstractEntity {
  @Index()
  @Column({ name: 'rule_version', type: 'varchar' })
  ruleVersion!: string;

  @Column({ name: 'criteria_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  criteriaJson!: Record<string, unknown>; // { noMovementDays: 180, ... }

  @Column({ type: 'varchar', default: 'ACTIVE' })
  status!: string;
}

// Kết quả đánh giá chậm luân chuyển (overlay).
@Entity('slow_moving_evaluation')
export class SlowMovingEvaluation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rule_id', type: 'uuid' })
  ruleId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'result_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  resultQty!: string;

  @Column({ name: 'evaluated_at', type: 'timestamptz', default: () => 'now()' })
  evaluatedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
