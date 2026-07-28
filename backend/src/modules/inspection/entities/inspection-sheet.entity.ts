import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { SheetStatus } from '../../../common/workflow';

// Phiếu kiểm kê (M07/UC-10). Thuộc một đợt + một doanh trại. Autosave khi DRAFT.
@Entity('inspection_sheets')
export class InspectionSheet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Index()
  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  @Column({ type: 'varchar', default: SheetStatus.DRAFT })
  status!: SheetStatus;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

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
