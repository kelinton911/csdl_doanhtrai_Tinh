import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { ScenarioStatus } from '../../../common/workflow';

// Phương án bảo đảm (M10/UC-16). Đã chốt không sửa trực tiếp — tạo bản thay thế.
@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Index()
  @Column({ name: 'scenario_run_id', type: 'uuid' })
  scenarioRunId!: string;

  // Phân bổ doanh trại/vật chất/nguồn lực + giả định.
  @Column({ type: 'jsonb', default: () => "'{}'" })
  allocations!: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  assumptions!: string | null;

  @Column({ type: 'varchar', default: ScenarioStatus.DRAFT })
  status!: ScenarioStatus;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
