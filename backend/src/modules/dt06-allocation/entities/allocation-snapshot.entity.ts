import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Snapshot phân bổ tại cutoff (Quyển VI §IX, BR-DT06-023/024) — sinh 01–06/KKDT, bất biến.
@Entity('allocation_snapshot')
export class AllocationSnapshot extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'snapshot_code', type: 'varchar' })
  snapshotCode!: string;

  @Index()
  @Column({ name: 'cutoff_time', type: 'timestamptz' })
  cutoffTime!: Date;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  scope!: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  checksum!: string | null;

  @Column({ type: 'boolean', default: false })
  locked!: boolean;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;
}

// Dòng snapshot phân bổ (bất biến sau khóa).
@Entity('allocation_snapshot_line')
export class AllocationSnapshotLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ name: 'allocation_type_code', type: 'varchar' })
  allocationTypeCode!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'reserved_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  reservedQty!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
