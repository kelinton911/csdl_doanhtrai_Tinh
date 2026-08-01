import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M16 — Nguồn lực doanh trại có thể huy động tại địa phương (cơ sở lưu trú/kho/xưởng,
// máy phát/bơm, vật liệu, nhà thầu, cơ sở cung ứng…). Không xóa cứng — dùng status INACTIVE.
@Entity('local_resources')
export class LocalResource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Nhóm: FACILITY | UTILITY | MATERIAL | EQUIPMENT | SERVICE | OTHER (suy từ resourceType).
  @Index()
  @Column()
  category!: string;

  // Loại nguồn lực cụ thể (LODGING, WAREHOUSE, GENERATOR, PUMP, CONSTRUCTION_FIRM…).
  @Column({ name: 'resource_type' })
  resourceType!: string;

  // Chủ thể quản lý.
  @Column({ name: 'owner_name', type: 'varchar', nullable: true })
  ownerName!: string | null;

  // STATE | ENTERPRISE | PRIVATE | INDIVIDUAL.
  @Column({ name: 'owner_type', type: 'varchar', nullable: true })
  ownerType!: string | null;

  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: unknown;

  // Khả năng cung ứng (mô tả) + số lượng có thể huy động + đơn vị.
  @Column({ name: 'capacity_desc', type: 'varchar', nullable: true })
  capacityDesc!: string | null;

  @Column({ name: 'capacity_qty', type: 'numeric', precision: 14, scale: 2, default: 0 })
  capacityQty!: string;

  @Column({ name: 'capacity_unit', type: 'varchar', nullable: true })
  capacityUnit!: string | null;

  // Thời gian huy động: IMMEDIATE | SHORT | MEDIUM | LONG.
  @Column({ name: 'mobilization_time', type: 'varchar', default: 'MEDIUM' })
  mobilizationTime!: string;

  // Độ tin cậy: HIGH | MEDIUM | LOW.
  @Column({ type: 'varchar', default: 'MEDIUM' })
  reliability!: string;

  // Hiệp đồng: số biên bản + hạn hiệu lực + trạng thái (NONE | SIGNED | EXPIRED).
  @Column({ name: 'agreement_no', type: 'varchar', nullable: true })
  agreementNo!: string | null;

  @Column({ name: 'agreement_valid_until', type: 'date', nullable: true })
  agreementValidUntil!: string | null;

  @Column({ name: 'agreement_status', type: 'varchar', default: 'NONE' })
  agreementStatus!: string;

  @Column({ name: 'surveyed_at', type: 'date', nullable: true })
  surveyedAt!: string | null;

  @Column({ name: 'survey_note', type: 'text', nullable: true })
  surveyNote!: string | null;

  // ACTIVE | INACTIVE.
  @Index()
  @Column({ type: 'varchar', default: 'ACTIVE' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

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
