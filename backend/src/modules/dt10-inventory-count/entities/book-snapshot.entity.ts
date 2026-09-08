import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Lớp BOOK: sổ sách tại cutoff (BR-DT10-002/003) — dựng từ sổ cái DT-04 (SUM quantity_signed POSTED
// ≤ cutoff) + chất lượng C1–5 tại thời điểm. locked=true ngay khi dựng ⇒ BẤT BIẾN (checksum chốt nội dung).
@Entity('book_snapshot')
export class BookSnapshot extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'as_of', type: 'timestamptz' })
  asOf!: Date;

  @Column({ type: 'varchar' })
  checksum!: string;

  @Column({ type: 'boolean', default: true })
  locked!: boolean;
}

// Dòng book_snapshot — đóng băng book_qty + grade1..5 + value. Không sửa sau khi snapshot LOCKED.
@Entity('book_snapshot_line')
export class BookSnapshotLine {
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

  @Column({ name: 'book_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  bookQty!: string;

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
