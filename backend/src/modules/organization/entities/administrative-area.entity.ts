import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Xã/phường (M02). Cấp tỉnh quản lý trực tiếp cấp xã — không có cấp huyện.
// Hình học lưu PostGIS (geometry) với SRID 4326; nạp sau khi có dữ liệu không gian.
@Entity('administrative_areas')
export class AdministrativeArea {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // WARD | COMMUNE
  @Column({ default: 'COMMUNE' })
  type!: string;

  // Ranh giới (MultiPolygon, SRID 4326). Nullable ở giai đoạn dữ liệu giả lập.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
    nullable: true,
  })
  geometry!: string | null;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
