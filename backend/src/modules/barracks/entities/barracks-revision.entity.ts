import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// Phiên bản hồ sơ doanh trại (No silent overwrite): mỗi lần gửi duyệt/chốt tạo
// một bản ghi bất biến chụp lại payload tại thời điểm đó.
@Entity('barracks_revisions')
@Index(['barracksId', 'revisionNo'], { unique: true })
export class BarracksRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'barracks_id', type: 'uuid' })
  barracksId!: string;

  @Column({ name: 'revision_no', type: 'int' })
  revisionNo!: number;

  // Ảnh chụp dữ liệu hồ sơ (JSONB).
  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'workflow_status', type: 'varchar' })
  workflowStatus!: WorkflowStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
