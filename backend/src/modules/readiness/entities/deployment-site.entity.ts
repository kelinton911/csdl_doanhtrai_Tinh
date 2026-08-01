import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M18 — Địa điểm sơ tán/phân tán/dự bị/bố trí lực lượng phục vụ chuyển trạng thái & tác chiến.
// Không xóa cứng — dùng status INACTIVE.
@Entity('deployment_sites')
export class DeploymentSite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // EVACUATION (sơ tán) | DISPERSAL (phân tán) | RESERVE (dự bị) | DEPLOYMENT (bố trí lực lượng)
  // | FIELD_MEDICAL (quân y dã chiến) | COMMAND_POST (sở chỉ huy dự bị).
  @Index()
  @Column({ name: 'site_type', type: 'varchar', default: 'EVACUATION' })
  siteType!: string;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: unknown;

  // Sức chứa quân số.
  @Column({ type: 'int', default: 0 })
  capacity!: number;

  // Khả năng che giấu: GOOD | FAIR | POOR.
  @Column({ type: 'varchar', nullable: true })
  concealment!: string | null;

  @Column({ name: 'access_road', type: 'varchar', nullable: true })
  accessRoad!: string | null;

  @Column({ name: 'has_power', type: 'boolean', default: false })
  hasPower!: boolean;

  @Column({ name: 'has_water', type: 'boolean', default: false })
  hasWater!: boolean;

  // Số nhà bạt/công trình dã chiến có thể triển khai.
  @Column({ name: 'tent_capability', type: 'int', default: 0 })
  tentCapability!: number;

  // Thời gian triển khai (giờ).
  @Column({ name: 'deploy_time_hours', type: 'numeric', precision: 6, scale: 1, default: 0 })
  deployTimeHours!: string;

  // Mức sẵn sàng: READY | PARTIAL | NOT_READY.
  @Index()
  @Column({ type: 'varchar', default: 'PARTIAL' })
  readiness!: string;

  // Vai trò phương án: PRIMARY | BACKUP | ALTERNATE.
  @Column({ type: 'varchar', default: 'PRIMARY' })
  role!: string;

  // M17 — trạng thái sử dụng dự kiến: NORMAL | SSCD | EVACUATION | COMBAT | RECOVERY.
  @Column({ name: 'defense_state', type: 'varchar', default: 'SSCD' })
  defenseState!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Index()
  @Column({ type: 'varchar', default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
