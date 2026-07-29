import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Điểm quan tâm trên bản đồ (M11). Dùng cho trạm, địa danh, sở chỉ huy, cổng... và điểm nhập ad-hoc.
// Đây là lớp điểm bổ trợ cho doanh trại/kho — nhập được qua Integration (UC-21) hoặc seed.
@Entity('map_pois')
export class MapPoi {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // TRAM | DIA_DANH | SO_CHI_HUY | CONG | ... (khớp bộ ký hiệu tùy biến VN ở frontend).
  @Column({ default: 'DIA_DANH' })
  category!: string;

  // Mã ký hiệu quân sự (nếu khác suy diễn mặc định từ category).
  @Column({ name: 'symbol_code', type: 'varchar', nullable: true })
  symbolCode!: string | null;

  // Địa bàn xã (nếu biết) + mã tỉnh để lọc theo phạm vi.
  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ name: 'province_code', type: 'varchar', nullable: true })
  provinceCode!: string | null;

  // Vị trí điểm (PostGIS Point, SRID 4326).
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: unknown;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
