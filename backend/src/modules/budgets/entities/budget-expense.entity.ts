import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// M14 — Thực chi / giải ngân + chứng từ, đối chiếu với dự toán/hạn mức.
@Entity('budget_expenses')
@Index(['budgetPlanId', 'expenseDate'])
export class BudgetExpense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'budget_plan_id', type: 'uuid' })
  budgetPlanId!: string;

  @Column({ name: 'budget_line_id', type: 'uuid', nullable: true })
  budgetLineId!: string | null;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate!: string;

  @Column({ type: 'numeric', precision: 16, scale: 2 })
  amount!: string;

  @Column({ name: 'voucher_no', type: 'varchar', nullable: true })
  voucherNo!: string | null;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
