import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Xung đột tách biệt trách nhiệm (SoD): hai chức năng không nên do cùng một chức vụ/tài khoản
// nắm giữ đồng thời. Kiểm tra khi gán chức năng cho chức vụ.
@Entity('permission_conflicts')
@Unique('UQ_permission_conflict_pair', ['functionCodeA', 'functionCodeB'])
export class PermissionConflict {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'function_code_a' })
  functionCodeA!: string;

  @Index()
  @Column({ name: 'function_code_b' })
  functionCodeB!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  // ConflictSeverity: BLOCK | WARN
  @Column({ default: 'BLOCK' })
  severity!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
