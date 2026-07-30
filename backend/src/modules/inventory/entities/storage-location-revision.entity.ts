import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// Phiên bản hồ sơ kho trạm (No silent overwrite): mỗi lần gửi duyệt/duyệt tạo một
// bản ghi bất biến chụp lại payload. Cùng khuôn với BarracksRevision.
@Entity('storage_location_revisions')
@Index(['storageLocationId', 'revisionNo'], { unique: true })
export class StorageLocationRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'storage_location_id', type: 'uuid' })
  storageLocationId!: string;

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
