import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TxType = 'IN' | 'OUT' | 'ADJUST';

// Sổ kho bất biến (M06/UC-08): chỉ INSERT; điều chỉnh bằng bút toán mới.
@Entity('inventory_transactions')
export class InventoryTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @Index()
  @Column({ name: 'storage_location_id', type: 'uuid' })
  storageLocationId!: string;

  // IN (nhập) | OUT (xuất) | ADJUST (điều chỉnh kiểm kê)
  @Column({ type: 'varchar' })
  type!: TxType;

  // Số lượng phát sinh (dương với IN/ADJUST tăng; có thể âm với ADJUST giảm).
  @Column({ type: 'numeric', precision: 18, scale: 3 })
  quantity!: string;

  // Số dư sau bút toán (ảnh chụp để truy nguyên).
  @Column({ name: 'balance_after', type: 'numeric', precision: 18, scale: 3 })
  balanceAfter!: string;

  @Column({ name: 'document_ref', type: 'varchar', nullable: true })
  documentRef!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
