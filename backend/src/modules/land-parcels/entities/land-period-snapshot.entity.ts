import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Ảnh chụp số liệu khu đất theo kỳ kiểm kê (per-parcel) để dựng cột đối chiếu
// "kỳ trước / tăng / giảm / kỳ này" của biểu 01/02/03. So khớp theo parcel_code giữa 2 kỳ:
// - kỳ này = số liệu hiện hành trên land_parcels; kỳ trước = snapshot kỳ gần nhất.
// - Tăng = thửa mới xuất hiện / diện tích tăng; Giảm = thửa mất đi / diện tích giảm.
@Entity('land_period_snapshots')
@Index(['periodDate', 'parcelCode'], { unique: true })
export class LandPeriodSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'period_date', type: 'date' })
  periodDate!: string;

  @Column({ name: 'land_parcel_id', type: 'uuid', nullable: true })
  landParcelId!: string | null;

  @Column({ name: 'parcel_code', type: 'varchar' })
  parcelCode!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'point_count', type: 'int', default: 1 })
  pointCount!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  area!: string;

  @Column({ name: 'area_defense', type: 'numeric', precision: 14, scale: 2, default: 0 })
  areaDefense!: string;

  @Column({ name: 'area_economic', type: 'numeric', precision: 14, scale: 2, default: 0 })
  areaEconomic!: string;

  @Column({ name: 'area_family', type: 'numeric', precision: 14, scale: 2, default: 0 })
  areaFamily!: string;

  @Column({ name: 'cert_count', type: 'int', default: 0 })
  certCount!: number;

  @Column({ name: 'cert_area', type: 'numeric', precision: 14, scale: 2, default: 0 })
  certArea!: string;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
