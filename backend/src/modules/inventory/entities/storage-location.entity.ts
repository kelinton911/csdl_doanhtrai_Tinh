import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Kho / địa điểm lưu giữ vật chất (M06).
@Entity('storage_locations')
export class StorageLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Loại kho (tham chiếu catalogs.type='storage-location-type').
  @Column({ name: 'type', type: 'varchar', nullable: true })
  type!: string | null;

  // Kho có thể thuộc một doanh trại.
  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  // Vị trí kho trên bản đồ (PostGIS Point, SRID 4326). Nullable khi chưa có toạ độ.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: unknown;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
