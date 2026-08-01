import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// M14 — Khoản mục / phân bổ hạn mức trong một dự toán. Liên kết mềm tới dự án (M13).
@Entity('budget_lines')
@Index(['budgetPlanId'])
export class BudgetLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'budget_plan_id', type: 'uuid' })
  budgetPlanId!: string;

  @Column()
  name!: string;

  // CONSTRUCTION | MAINTENANCE | EQUIPMENT | UTILITY | MATERIAL | OTHER.
  @Column({ type: 'varchar', default: 'OTHER' })
  category!: string;

  @Column({ name: 'allocated_amount', type: 'numeric', precision: 16, scale: 2, default: 0 })
  allocatedAmount!: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
