import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Dòng snapshot (Quyển IV §VIII) — bất biến sau khi snapshot LOCKED.
@Entity('materiel_snapshot_line')
export class MaterielSnapshotLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'quantity_on_hand', type: 'numeric', precision: 18, scale: 3, default: 0 })
  quantityOnHand!: string;

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
}
