import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Cấp quyền lẻ trực tiếp cho tài khoản (ngoài chức vụ), có thể có hạn dùng và thu hồi.
// Dùng cho trường hợp ngoại lệ, ủy quyền tạm thời.
@Entity('user_permission_grants')
export class UserPermissionGrant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // Mã chức năng được cấp (tham chiếu functions.code).
  @Index()
  @Column({ name: 'function_code' })
  functionCode!: string;

  // FunctionScope: SELF | UNIT | PROVINCE | ALL
  @Column({ default: 'SELF' })
  scope!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  reason!: string | null;

  @Column({ name: 'granted_by_id', type: 'uuid' })
  grantedById!: string;

  @Column({ name: 'granted_at', type: 'timestamptz', default: () => 'now()' })
  grantedAt!: Date;

  @Index()
  @Column({ name: 'is_revoked', default: false })
  isRevoked!: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoked_by_id', type: 'uuid', nullable: true })
  revokedById!: string | null;

  @Column({ name: 'revoked_reason', type: 'varchar', nullable: true })
  revokedReason!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
