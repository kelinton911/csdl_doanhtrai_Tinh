import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// M04 — Hồ sơ khu đất quốc phòng. Mã duy nhất toàn tỉnh; không xóa cứng;
// bản APPROVED không sửa trực tiếp (tạo revision). Quản lý ranh giới (MultiPolygon),
// mốc giới (bảng riêng), nguồn gốc/hồ sơ pháp lý, tranh chấp/lấn chiếm.
@Entity('land_parcels')
export class LandParcel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Đơn vị quản lý + địa bàn hành chính (xã/phường/đặc khu).
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  // Liên kết mềm tới doanh trại đang đóng trên khu đất (nếu có).
  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  // Diện tích (m2) — numeric để đối chiếu chính xác (TypeORM trả chuỗi).
  @Column({ name: 'land_area', type: 'numeric', precision: 14, scale: 2, default: 0 })
  landArea!: string;

  // Mục đích/loại đất: QUOC_PHONG | HON_HOP | KHAC.
  @Column({ name: 'land_use_type', type: 'varchar', nullable: true })
  landUseType!: string | null;

  // Hiện trạng sử dụng: IN_USE | VACANT | PLANNED | RESERVE | LEASED.
  @Column({ name: 'usage_status', type: 'varchar', default: 'IN_USE' })
  usageStatus!: string;

  // Hồ sơ pháp lý: CERTIFICATE | DECISION | PENDING | NONE.
  @Column({ name: 'legal_status', type: 'varchar', default: 'PENDING' })
  legalStatus!: string;

  @Column({ name: 'legal_origin', type: 'varchar', nullable: true })
  legalOrigin!: string | null;

  @Column({ name: 'certificate_no', type: 'varchar', nullable: true })
  certificateNo!: string | null;

  // Tranh chấp/lấn chiếm: NONE | DISPUTED | ENCROACHED.
  @Index()
  @Column({ name: 'dispute_status', type: 'varchar', default: 'NONE' })
  disputeStatus!: string;

  @Column({ name: 'dispute_note', type: 'text', nullable: true })
  disputeNote!: string | null;

  @Column({ name: 'access_road', type: 'varchar', nullable: true })
  accessRoad!: string | null;

  @Column({ name: 'has_electricity', type: 'boolean', default: false })
  hasElectricity!: boolean;

  @Column({ name: 'has_water', type: 'boolean', default: false })
  hasWater!: boolean;

  // Khả năng mở rộng: NONE | LIMITED | GOOD.
  @Column({ name: 'expansion_capability', type: 'varchar', nullable: true })
  expansionCapability!: string | null;

  // Tình trạng an toàn: SAFE | RISK | UNSAFE.
  @Column({ name: 'safety_status', type: 'varchar', nullable: true })
  safetyStatus!: string | null;

  // Ranh giới khu đất (PostGIS MultiPolygon 4326) + điểm đại diện (Point).
  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  boundary!: unknown;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: unknown;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'workflow_status', type: 'varchar', default: WorkflowStatus.DRAFT })
  workflowStatus!: WorkflowStatus;

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
