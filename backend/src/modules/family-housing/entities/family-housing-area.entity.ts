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

// Khu gia đình quân đội đang quản lý, chưa bàn giao địa phương (biểu 01/KK-KGĐ).
// Mã duy nhất; theo dõi tổng diện tích, số hộ, hồ sơ pháp lý, lý do & dự kiến bàn giao.
@Entity('family_housing_areas')
export class FamilyHousingArea {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  // Địa chỉ (xã, huyện, tỉnh) — biểu ghi gộp.
  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ name: 'total_area', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalArea!: string;

  @Column({ name: 'household_count', type: 'int', default: 0 })
  householdCount!: number;

  // Hồ sơ pháp lý hình thành khu gia đình (Văn bản số... ngày.../của...).
  @Column({ name: 'legal_doc', type: 'text', nullable: true })
  legalDoc!: string | null;

  @Column({ name: 'not_handed_reason', type: 'text', nullable: true })
  notHandedReason!: string | null;

  @Column({ name: 'planned_handover', type: 'varchar', nullable: true })
  plannedHandover!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Index()
  @Column({ name: 'data_source', type: 'varchar', nullable: true })
  dataSource!: string | null;

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
