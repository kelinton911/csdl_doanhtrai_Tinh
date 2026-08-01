import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M14 — Dự toán / kế hoạch ngân sách doanh trại theo niên độ + đơn vị + nguồn vốn.
// Vòng đời: DRAFT → APPROVED (chốt dự toán) → CLOSED (quyết toán). Không xóa cứng.
@Entity('budget_plans')
export class BudgetPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Index()
  @Column({ name: 'fiscal_year', type: 'int' })
  fiscalYear!: number;

  // DEFENSE_BUDGET | STATE_BUDGET | LOCAL | OTHER.
  @Column({ name: 'funding_source', type: 'varchar', nullable: true })
  fundingSource!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  // Tổng dự toán (VND). numeric → TypeORM trả chuỗi.
  @Column({ name: 'planned_amount', type: 'numeric', precision: 16, scale: 2, default: 0 })
  plannedAmount!: string;

  // DRAFT | APPROVED | CLOSED.
  @Index()
  @Column({ type: 'varchar', default: 'DRAFT' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
