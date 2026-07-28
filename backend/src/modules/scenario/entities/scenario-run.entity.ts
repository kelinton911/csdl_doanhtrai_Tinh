import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Lần chạy mô hình (M10). Gắn thuật toán, phiên bản dữ liệu và thời điểm chạy; kết quả tái lập.
@Entity('scenario_runs')
export class ScenarioRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'scenario_id', type: 'uuid' })
  scenarioId!: string;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'algorithm', type: 'varchar', default: 'assurance-v1' })
  algorithm!: string;

  // Ảnh chụp dữ liệu đầu vào (tham số + tổng hợp tồn/khả năng tại thời điểm chạy).
  @Column({ name: 'input_snapshot', type: 'jsonb', default: () => "'{}'" })
  inputSnapshot!: Record<string, unknown>;

  // Kết quả: {accommodation, supplies:[{material,required,available,shortage}], confidence}
  @Column({ type: 'jsonb', default: () => "'{}'" })
  metrics!: Record<string, unknown>;

  @Column({ name: 'run_by', type: 'uuid', nullable: true })
  runBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
