import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M13 — Dự án xây dựng cơ bản / đầu tư / sửa chữa lớn. Quản lý trọn vòng đời qua `phase`;
// hoàn thành (HANDED_OVER) tự sinh tài sản (facility). Không xóa cứng — dùng phase CANCELLED.
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // NEW_BUILD | RENOVATION | REPAIR | UPGRADE | INFRASTRUCTURE.
  @Column({ name: 'project_type' })
  projectType!: string;

  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // Nguồn vốn: DEFENSE_BUDGET | STATE_BUDGET | LOCAL | OTHER.
  @Column({ name: 'funding_source', type: 'varchar', nullable: true })
  fundingSource!: string | null;

  // Tổng dự toán + vốn được duyệt (VND). numeric → TypeORM trả chuỗi.
  @Column({ name: 'total_estimate', type: 'numeric', precision: 16, scale: 2, default: 0 })
  totalEstimate!: string;

  @Column({ name: 'approved_capital', type: 'numeric', precision: 16, scale: 2, default: 0 })
  approvedCapital!: string;

  @Column({ name: 'contractor_name', type: 'varchar', nullable: true })
  contractorName!: string | null;

  @Column({ name: 'contract_no', type: 'varchar', nullable: true })
  contractNo!: string | null;

  @Column({ name: 'contract_value', type: 'numeric', precision: 16, scale: 2, default: 0 })
  contractValue!: string;

  @Column({ name: 'contract_signed_date', type: 'date', nullable: true })
  contractSignedDate!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'planned_end_date', type: 'date', nullable: true })
  plannedEndDate!: string | null;

  @Column({ name: 'actual_end_date', type: 'date', nullable: true })
  actualEndDate!: string | null;

  @Column({ name: 'progress_percent', type: 'int', default: 0 })
  progressPercent!: number;

  // Giai đoạn vòng đời: PROPOSAL | DESIGN | BIDDING | CONTRACTED | IN_PROGRESS |
  // ACCEPTANCE | HANDED_OVER | WARRANTY | CLOSED | CANCELLED.
  @Index()
  @Column({ type: 'varchar', default: 'PROPOSAL' })
  phase!: string;

  // Tài sản (facility) được sinh khi bàn giao — tránh sinh trùng.
  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
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
