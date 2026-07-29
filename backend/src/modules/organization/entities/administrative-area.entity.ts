import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Địa bàn hành chính (M02). Cấp tỉnh quản lý trực tiếp cấp xã — không có cấp huyện.
// Một bảng chứa cả cấp tỉnh (level=PROVINCE) và cấp xã (level=COMMUNE) theo sắp xếp 2025.
// Hình học lưu PostGIS (geometry) với SRID 4326; nạp từ dữ liệu ranh giới thật.
@Entity('administrative_areas')
export class AdministrativeArea {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Cấp hành chính: PROVINCE | COMMUNE.
  @Column({ default: 'COMMUNE' })
  level!: string;

  // Loại đơn vị: cấp tỉnh (TINH | THANH_PHO) hoặc cấp xã (WARD | COMMUNE | SPECIAL_ZONE = đặc khu).
  @Column({ default: 'COMMUNE' })
  type!: string;

  // Mã đơn vị cha (mã tỉnh với cấp xã). Cấp tỉnh để trống.
  @Column({ name: 'parent_code', type: 'varchar', nullable: true })
  parentCode!: string | null;

  // Mã tỉnh (tiện lọc nhanh theo tỉnh cho cả tỉnh lẫn xã).
  @Column({ name: 'province_code', type: 'varchar', nullable: true })
  provinceCode!: string | null;

  // Ranh giới (MultiPolygon, SRID 4326). Nullable khi chưa có dữ liệu không gian.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
    nullable: true,
  })
  geometry!: string | null;

  // Điểm đại diện để đặt nhãn/marker (Point, SRID 4326).
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  centroid!: string | null;

  // Nguồn dữ liệu (tên tệp/nghị quyết) để truy vết, không bịa.
  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
