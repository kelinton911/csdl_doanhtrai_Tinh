import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// Phiên bản bất biến của bản khai báo (No silent overwrite): mỗi lần chuyển trạng thái
// (gửi/duyệt/trả lại/mở khóa) chụp lại payload — dùng transitionWithRevision.
@Entity('material_declaration_revisions')
@Index(['declarationId', 'revisionNo'], { unique: true })
export class MaterialDeclarationRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'declaration_id', type: 'uuid' })
  declarationId!: string;

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
