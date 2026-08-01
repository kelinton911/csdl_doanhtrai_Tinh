import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Định mức / quy ước tính toán HC-KT (Khâu 4) — căn cứ: docs/Quiuoctinhtoan.pdf.
// Nạp trung thực theo 6 ngành. `calcRole` cho engine biết cách dùng khi tính bảo đảm.
@Entity('logistics_calc_norms')
@Index(['branch', 'code'], { unique: true })
export class LogisticsCalcNorm {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // QN | QY | XD | VT | DT | QS
  @Column({ type: 'varchar' })
  branch!: string;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  unit!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  value!: string | null;

  // Diễn giải cơ sở tính (kg/người/ngày, kg/bộ, %, kg/lít…).
  @Column({ type: 'varchar', nullable: true })
  basis!: string | null;

  // Cách engine dùng: PERSON_DAY | PERSON_MONTH | PERSON_ONCE | CASUALTY_COSO | REFERENCE.
  @Column({ name: 'calc_role', type: 'varchar', default: 'REFERENCE' })
  calcRole!: string;

  // Dữ liệu phụ: khẩu phần chi tiết, bảng con (tiêu thụ theo xe, cơ số quân y…), tbPerUnit…
  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes!: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
