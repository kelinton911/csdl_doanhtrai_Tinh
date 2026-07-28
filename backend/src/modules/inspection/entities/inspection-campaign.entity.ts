import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { InspectionStatus } from '../../../common/workflow';

// Đợt kiểm kê (M07/UC-09). Phạm vi cố định sau khi phát hành (OPEN), trừ khi tạo phiên bản mới.
@Entity('inspection_campaigns')
export class InspectionCampaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Phạm vi: {areaIds?:[], organizationIds?:[], note?}
  @Column({ type: 'jsonb', default: () => "'{}'" })
  scope!: Record<string, unknown>;

  @Column({ type: 'varchar', default: InspectionStatus.PLANNED })
  status!: InspectionStatus;

  @Column({ name: 'planned_from', type: 'timestamptz', nullable: true })
  plannedFrom!: Date | null;

  @Column({ name: 'planned_to', type: 'timestamptz', nullable: true })
  plannedTo!: Date | null;

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
