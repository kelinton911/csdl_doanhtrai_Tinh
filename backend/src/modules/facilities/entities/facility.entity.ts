import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { FacilityStatus } from '../facility-status';

// Công trình / hạng mục thuộc doanh trại (M05). UC-07.
// Mã duy nhất trong phạm vi một doanh trại; không xóa cứng — dùng DECOMMISSIONED.
@Entity('facilities')
@Index(['barracksId', 'code'], { unique: true })
export class Facility {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'barracks_id', type: 'uuid' })
  barracksId!: string;

  @Column()
  code!: string;

  @Column()
  name!: string;

  // Loại công trình (tham chiếu danh mục M03 sau này) — hiện lưu chuỗi tự do.
  @Column({ name: 'type', type: 'varchar', nullable: true })
  type!: string | null;

  // Mã trong TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI (Phụ lục CV 2837/DT-QLDT),
  // các chương I–IV và XVII (đất, nhà, nhà kho-xưởng, vật kiến trúc, nhà che khí tài).
  // Tham chiếu MỀM tới asset_catalog_items.code.
  @Index()
  @Column({ name: 'asset_code', type: 'varchar', nullable: true })
  assetCode!: string | null;

  // UNMAPPED | MAPPED | OUT_OF_SCOPE | PROPOSED
  @Column({ name: 'asset_code_status', default: 'UNMAPPED' })
  assetCodeStatus!: string;

  // Diện tích (m2) — numeric để đối chiếu chính xác, không dùng float.
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  area!: string;

  @Column({ name: 'declared_capacity', type: 'int', default: 0 })
  declaredCapacity!: number;

  @Column({ name: 'build_year', type: 'int', nullable: true })
  buildYear!: number | null;

  // Cấp chất lượng/hiện trạng: GOOD | FAIR | POOR | ...
  @Column({ name: 'condition', type: 'varchar', nullable: true })
  condition!: string | null;

  @Column({ type: 'varchar', default: FacilityStatus.IN_USE })
  status!: FacilityStatus;

  // ---- Thuộc tính nhà theo biểu 02/KK-NHA (bổ sung; đều nullable/có default) ----

  // Cấp nhà: I | II | III | IV.
  @Column({ name: 'house_class', type: 'varchar', nullable: true })
  houseClass!: string | null;

  // Số tầng nhà.
  @Column({ name: 'floors', type: 'int', nullable: true })
  floors!: number | null;

  // Diện tích sàn xây dựng (m2).
  @Column({ name: 'floor_area', type: 'numeric', precision: 12, scale: 2, nullable: true })
  floorArea!: string | null;

  // Diện tích sử dụng (m2).
  @Column({ name: 'use_area', type: 'numeric', precision: 12, scale: 2, nullable: true })
  useArea!: string | null;

  // Tính chất sử dụng: SHLV | KHO | XUONG | GIANG_DUONG | BENH_XA | ...
  @Column({ name: 'usage_nature', type: 'varchar', nullable: true })
  usageNature!: string | null;

  // Thu sét (có/không).
  @Column({ name: 'lightning_protection', type: 'boolean', default: false })
  lightningProtection!: boolean;

  // Kết cấu chính: móng/nền/tường/cột/sàn/kèo/mái.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  structure!: Record<string, unknown>;

  // Hạ tầng: nguồn điện/nước, tường rào, đường giao thông.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  utilities!: Record<string, unknown>;

  // Nhu cầu sửa chữa: Lớn | Vừa | Nhỏ.
  @Column({ name: 'repair_need', type: 'varchar', nullable: true })
  repairNeed!: string | null;

  // Vị trí/hình công trình (PostGIS Point 4326), nullable ở giai đoạn giả lập.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: unknown;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
