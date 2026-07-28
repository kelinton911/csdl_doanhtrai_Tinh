import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Tài khoản người dùng (M01). Phạm vi dữ liệu theo đơn vị + danh sách vai trò.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  username!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({ name: 'full_name' })
  fullName!: string;

  // Vai trò RBAC (mảng chuỗi). Xem enum Role.
  @Column('text', { array: true, default: '{}' })
  roles!: string[];

  // Phạm vi dữ liệu: đơn vị người dùng thuộc về.
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // ACTIVE | LOCKED | EXPIRED
  @Column({ default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'failed_attempts', default: 0 })
  failedAttempts!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Optimistic concurrency (ETag/If-Match, chống ghi đè âm thầm).
  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
