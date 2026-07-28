import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Ghi nhận hư hỏng/thiệt hại (M09/UC-13). Sự kiện mô phỏng phải có cờ scenario=true,
// tách khỏi dữ liệu thực.
@Entity('damage_events')
export class DamageEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // barracks | facility
  @Index()
  @Column({ name: 'entity_type', type: 'varchar' })
  entityType!: string;

  @Index()
  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  // Nguyên nhân (catalogs.type='damage-cause').
  @Column({ name: 'cause_code', type: 'varchar', nullable: true })
  causeCode!: string | null;

  // LOW | MEDIUM | HIGH | CRITICAL
  @Column({ default: 'MEDIUM' })
  severity!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ name: 'estimated_loss', type: 'numeric', precision: 18, scale: 0, default: 0 })
  estimatedLoss!: string;

  // REPORTED | VERIFIED
  @Column({ default: 'REPORTED' })
  status!: string;

  // Tách dữ liệu mô phỏng khỏi dữ liệu thực.
  @Column({ type: 'boolean', default: false })
  scenario!: boolean;

  @Column({ name: 'reported_by', type: 'uuid', nullable: true })
  reportedBy!: string | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
