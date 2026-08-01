import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Dòng vật chất trong bản khai báo SSCĐ — khung KKDT: số lượng theo cấp chất lượng 1–5
// (cùng cách mô hình với stock_quality_details.qty_grade_1..5).
@Entity('readiness_material_lines')
@Index(['planId'])
export class ReadinessMaterialLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @Column({ name: 'unit_code', type: 'varchar', nullable: true })
  unitCode!: string | null;

  @Column({ name: 'qty_grade_1', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade1!: string;

  @Column({ name: 'qty_grade_2', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade2!: string;

  @Column({ name: 'qty_grade_3', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade3!: string;

  @Column({ name: 'qty_grade_4', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade4!: string;

  @Column({ name: 'qty_grade_5', type: 'numeric', precision: 18, scale: 3, default: 0 })
  qtyGrade5!: string;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
