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

// Tình huống (M10/UC-15). Kết quả tính toán tách khỏi tồn kho thực; luôn có version + thời điểm.
@Entity('scenarios')
export class Scenario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Tham số: {troopCount, durationDays, damageLevel, powerAvailable, waterAvailable, note}
  @Column({ type: 'jsonb', default: () => "'{}'" })
  parameters!: Record<string, unknown>;

  @Column({ type: 'varchar', default: ScenarioStatus.DRAFT })
  status!: ScenarioStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
