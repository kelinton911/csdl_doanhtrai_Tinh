import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Ảnh chụp biến động tồn theo kỳ kiểm kê (kỳ trước / tăng / giảm / kỳ này) để dựng cột
// đối chiếu của mọi biểu KK. campaign_id tham chiếu MỀM tới inspection_campaigns (kỳ kiểm kê).
@Entity('inventory_period_snapshots')
@Index(
  ['campaignId', 'materialId', 'storageLocationId', 'reservePurpose'],
  { unique: true },
)
export class InventoryPeriodSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @Column({ name: 'storage_location_id', type: 'uuid', nullable: true })
  storageLocationId!: string | null;

  @Column({ name: 'reserve_purpose', default: 'THUONG_XUYEN' })
  reservePurpose!: string;

  @Column({ name: 'opening_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  openingQty!: string;

  @Column({ name: 'increase_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  increaseQty!: string;

  @Column({ name: 'decrease_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  decreaseQty!: string;

  @Column({ name: 'closing_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  closingQty!: string;

  @Column({ name: 'opening_value', type: 'numeric', precision: 18, scale: 3, nullable: true })
  openingValue!: string | null;

  @Column({ name: 'closing_value', type: 'numeric', precision: 18, scale: 3, nullable: true })
  closingValue!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
