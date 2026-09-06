import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Chức năng hạt mịn (RBAC). `code` dạng MODULE_ACTION, vd BARRACKS_UPDATE, REPORT_EXPORT.
// Đặt tên class là AppFunction để tránh trùng từ khóa Function của JS.
@Entity('functions')
export class AppFunction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  // Module nghiệp vụ (vd BARRACKS, LAND_PARCEL, INVENTORY, REPORT...).
  @Index()
  @Column()
  module!: string;

  // ActionType: VIEW | CREATE | UPDATE | DELETE | APPROVE | EXPORT | IMPORT
  @Column({ name: 'action_type', default: 'VIEW' })
  actionType!: string;

  // Chức năng nhạy cảm (kiểm soát chặt hơn, dùng cho SoD/audit).
  @Column({ name: 'is_critical', default: false })
  isCritical!: boolean;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
