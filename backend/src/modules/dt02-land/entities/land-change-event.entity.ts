import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { LandChangeType } from '../dt02.enums';

// Biến động điểm đất (Quyển II §VIII, BR-DT02-005/007). Append-only — diện tích tại
// kỳ kiểm kê tính từ diện tích gốc + Σ biến động ≤ cutoff (không sửa số kỳ trước).
@Entity('land_change_event')
export class LandChangeEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'land_point_id', type: 'uuid' })
  landPointId!: string;

  @Column({ name: 'change_type', type: 'varchar' })
  changeType!: LandChangeType;

  @Column({ name: 'point_delta', type: 'int', default: 0 })
  pointDelta!: number;

  @Column({ name: 'area_delta_m2', type: 'numeric', precision: 18, scale: 2, default: 0 })
  areaDeltaM2!: string;

  @Index()
  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'doc_id', type: 'uuid', nullable: true })
  docId!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
