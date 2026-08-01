import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M11 — Hệ thống hạ tầng kỹ thuật: điện (lưới/trạm biến áp/máy phát/điện nội bộ),
// nước (nguồn/giếng/bể chứa/xử lý/mạng), nhiên liệu (téc). Không xóa cứng — dùng DECOMMISSIONED.
@Entity('utility_systems')
export class UtilitySystem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Nhóm: ELECTRICITY | WATER | FUEL (suy từ kind ở service để nhất quán).
  @Index()
  @Column()
  category!: string;

  // Loại cụ thể: POWER_GRID | TRANSFORMER | GENERATOR | POWER_INTERNAL |
  // WATER_SOURCE | WELL | WATER_TANK | WATER_TREATMENT | WATER_NETWORK | FUEL_TANK.
  @Column()
  kind!: string;

  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // Công suất/dung tích + đơn vị (kVA, kW, m3, m3/h…). numeric → TypeORM trả chuỗi.
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  capacity!: string;

  @Column({ name: 'capacity_unit', type: 'varchar', nullable: true })
  capacityUnit!: string | null;

  // Lượng dự trữ (nước/nhiên liệu) + đơn vị.
  @Column({ name: 'reserve_volume', type: 'numeric', precision: 14, scale: 2, default: 0 })
  reserveVolume!: string;

  @Column({ name: 'reserve_unit', type: 'varchar', nullable: true })
  reserveUnit!: string | null;

  // Máy phát/téc: loại nhiên liệu + mức nhiên liệu hiện có (lít).
  @Column({ name: 'fuel_type', type: 'varchar', nullable: true })
  fuelType!: string | null;

  @Column({ name: 'fuel_level', type: 'numeric', precision: 12, scale: 2, default: 0 })
  fuelLevel!: string;

  // Khả năng tự bảo đảm (giờ) khi mất nguồn ngoài.
  @Column({ name: 'autonomy_hours', type: 'numeric', precision: 8, scale: 1, default: 0 })
  autonomyHours!: string;

  // Số công tơ điện / đồng hồ nước.
  @Column({ name: 'meter_no', type: 'varchar', nullable: true })
  meterNo!: string | null;

  // OPERATIONAL | STANDBY | MAINTENANCE | FAULT | DECOMMISSIONED.
  @Index()
  @Column({ type: 'varchar', default: 'OPERATIONAL' })
  status!: string;

  @Column({ name: 'last_maintenance_at', type: 'timestamptz', nullable: true })
  lastMaintenanceAt!: Date | null;

  @Column({ name: 'next_maintenance_at', type: 'timestamptz', nullable: true })
  nextMaintenanceAt!: Date | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: unknown;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

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
