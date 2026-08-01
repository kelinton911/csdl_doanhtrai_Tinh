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

// Trục B — Bản khai báo vật chất SSCĐ theo MỨC của một xã (một bản/mức/xã, lịch sử ở revision).
// Workflow chuẩn DRAFT→PENDING_REVIEW→APPROVED (tái dùng transitionWithRevision).
@Entity('readiness_material_plans')
@Index(['areaId', 'readinessState'], { unique: true })
export class ReadinessMaterialPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'area_id', type: 'uuid' })
  areaId!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // THUONG_XUYEN | TANG_CUONG | CAO | TOAN_BO (READINESS_STATES).
  @Column({ name: 'readiness_state', type: 'varchar' })
  readinessState!: string;

  @Column({ name: 'workflow_status', type: 'varchar', default: WorkflowStatus.DRAFT })
  workflowStatus!: WorkflowStatus;

  // Truy vết copy-forward: mức nguồn + id bản nguồn đã sao chép.
  @Column({ name: 'copied_from_state', type: 'varchar', nullable: true })
  copiedFromState!: string | null;

  @Column({ name: 'copied_from_plan_id', type: 'uuid', nullable: true })
  copiedFromPlanId!: string | null;

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
