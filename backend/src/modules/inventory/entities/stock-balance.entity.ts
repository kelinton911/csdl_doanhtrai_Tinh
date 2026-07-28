import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Số dư tồn kho theo (vật chất × kho). Cập nhật đồng thời với mỗi bút toán trong transaction.
@Entity('stock_balances')
@Index(['materialId', 'storageLocationId'], { unique: true })
export class StockBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @Column({ name: 'storage_location_id', type: 'uuid' })
  storageLocationId!: string;

  // Tồn sổ sách hiện tại.
  @Column({ name: 'on_hand', type: 'numeric', precision: 18, scale: 3, default: 0 })
  onHand!: string;

  // Số kiểm kê gần nhất (đối chiếu chênh lệch).
  @Column({ name: 'last_counted', type: 'numeric', precision: 18, scale: 3, nullable: true })
  lastCounted!: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
