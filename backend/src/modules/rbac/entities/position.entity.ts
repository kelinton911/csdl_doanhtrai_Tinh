import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Chức vụ (RBAC). Gán chức năng qua position_functions; gán cho tài khoản qua user_positions.
@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  // PositionScope: UNIT | PROVINCE | SYSTEM
  @Column({ name: 'position_scope', default: 'UNIT' })
  positionScope!: string;

  // Cấp bậc chức vụ (số nhỏ = cao hơn), phục vụ sắp xếp/hiển thị.
  @Column({ default: 0 })
  level!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
