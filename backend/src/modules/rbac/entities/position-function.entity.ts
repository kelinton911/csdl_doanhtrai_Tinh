import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

// Ma trận phân quyền: gán một chức năng cho một chức vụ, kèm phạm vi dữ liệu (scope).
// Khóa mềm position_id/function_id (đọc quan hệ bằng query, khớp phong cách domain hiện có).
@Entity('position_functions')
@Unique('UQ_position_function', ['positionId', 'functionId'])
export class PositionFunction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'position_id', type: 'uuid' })
  positionId!: string;

  @Index()
  @Column({ name: 'function_id', type: 'uuid' })
  functionId!: string;

  // FunctionScope: SELF | UNIT | PROVINCE | ALL
  @Column({ default: 'SELF' })
  scope!: string;

  // Điều kiện bổ sung (tùy chọn), vd giới hạn theo trạng thái/loại đối tượng.
  @Column({ type: 'jsonb', nullable: true })
  conditions!: Record<string, unknown> | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
