import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Lớp OFFICIAL: số liệu chính thức sau đối chiếu (BR-DT10-019/020). version tăng mỗi revision;
// checksum gắn version. Khóa qua official_lock ⇒ BẤT BIẾN; sửa sau khóa buộc revision (version mới).
@Entity('official_snapshot')
export class OfficialSnapshot extends AbstractEntity {
  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'varchar' })
  checksum!: string;

  @Column({ name: 'revision_reason', type: 'text', nullable: true })
  revisionReason!: string | null;
}

// Dòng official_snapshot — đóng băng official_qty + grade1..5 + value theo version.
@Entity('official_snapshot_line')
export class OfficialSnapshotLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'official_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  officialQty!: string;

  @Column({ name: 'grade1', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade1!: string;
  @Column({ name: 'grade2', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade2!: string;
  @Column({ name: 'grade3', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade3!: string;
  @Column({ name: 'grade4', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade4!: string;
  @Column({ name: 'grade5', type: 'numeric', precision: 18, scale: 3, default: 0 })
  grade5!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, nullable: true })
  value!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

// Khóa official_snapshot (BR-DT10-019). Có bản ghi lock & unlock_reason=null ⇒ đang khóa bất biến.
@Entity('official_lock')
export class OfficialLock extends AbstractEntity {
  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ name: 'snapshot_version', type: 'int' })
  snapshotVersion!: number;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;

  @Column({ name: 'locked_at', type: 'timestamptz' })
  lockedAt!: Date;

  @Column({ name: 'unlock_reason', type: 'text', nullable: true })
  unlockReason!: string | null;

  @Column({ name: 'unlocked_at', type: 'timestamptz', nullable: true })
  unlockedAt!: Date | null;
}
