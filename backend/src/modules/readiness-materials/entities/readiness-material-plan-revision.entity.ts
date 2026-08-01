import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// Phiên bản bất biến của bản khai báo SSCĐ (No silent overwrite): mỗi lần gửi duyệt/duyệt/
// yêu cầu bổ sung chụp lại header + toàn bộ dòng. Cùng khuôn StorageLocationRevision.
@Entity('readiness_material_plan_revisions')
@Index(['planId', 'revisionNo'], { unique: true })
export class ReadinessMaterialPlanRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @Column({ name: 'revision_no', type: 'int' })
  revisionNo!: number;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'workflow_status', type: 'varchar' })
  workflowStatus!: WorkflowStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
