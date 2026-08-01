import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M19 — Nhiệm vụ khắc phục hậu quả/thiệt hại: điều phối vật liệu & lực lượng để phục hồi.
// Bổ trợ damage_events (M09): có thể tham chiếu qua damage_event_id. Dữ liệu mô phỏng gắn scenario=true.
@Entity('recovery_tasks')
export class RecoveryTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  title!: string;

  // LIGHT | MODERATE | HEAVY | DESTROYED.
  @Column({ type: 'varchar', default: 'MODERATE' })
  severity!: string;

  // Khu vực nguy hiểm (đánh dấu để cảnh báo/né tránh).
  @Index()
  @Column({ name: 'danger_zone', type: 'boolean', default: false })
  dangerZone!: boolean;

  @Column({ name: 'damage_event_id', type: 'uuid', nullable: true })
  damageEventId!: string | null;

  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: unknown;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // Điều phối: vật liệu cần + lực lượng cần/được giao.
  @Column({ name: 'needed_materials', type: 'text', nullable: true })
  neededMaterials!: string | null;

  @Column({ name: 'needed_forces', type: 'text', nullable: true })
  neededForces!: string | null;

  @Column({ name: 'assigned_note', type: 'text', nullable: true })
  assignedNote!: string | null;

  @Column({ name: 'estimated_loss', type: 'numeric', precision: 18, scale: 0, default: 0 })
  estimatedLoss!: string;

  // ASSESSING | COORDINATING | IN_PROGRESS | RECOVERED.
  @Index()
  @Column({ type: 'varchar', default: 'ASSESSING' })
  status!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt!: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  scenario!: boolean;

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
