import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// DT-09 — Ảnh chụp cân đối tại phê duyệt, BẤT BIẾN (BR-DT09-020). checksum chốt nội dung;
// source_fingerprint truy tới trạng thái verification/mobilization của các nguồn đã giữ chỗ.
@Entity('balance_snapshot')
export class BalanceSnapshot extends AbstractEntity {
  @Index()
  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'plan_revision_no', type: 'int' })
  planRevisionNo!: number;

  @Column({ name: 'approved_at', type: 'timestamptz' })
  approvedAt!: Date;

  @Column({ type: 'varchar' })
  checksum!: string;

  @Column({ name: 'source_fingerprint', type: 'varchar' })
  sourceFingerprint!: string;

  @Column({ type: 'boolean', default: true })
  locked!: boolean;
}

// Dòng ảnh chụp: đóng băng supply_required/planned/gap + ref nguồn đã giữ chỗ (reservations_json).
@Entity('balance_snapshot_line')
export class BalanceSnapshotLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'supply_required', type: 'numeric', precision: 18, scale: 3, default: 0 })
  supplyRequired!: string;

  @Column({ name: 'planned_source_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  plannedSourceQty!: string;

  @Column({ name: 'gap_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  gapQty!: string;

  @Column({ name: 'reservations_json', type: 'jsonb', default: () => "'[]'::jsonb" })
  reservationsJson!: unknown;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
