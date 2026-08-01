import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// Phiên bản hồ sơ khu đất (No silent overwrite): mỗi lần gửi duyệt/chốt tạo bản ghi bất biến.
@Entity('land_parcel_revisions')
@Index(['landParcelId', 'revisionNo'], { unique: true })
export class LandParcelRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'land_parcel_id', type: 'uuid' })
  landParcelId!: string;

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
