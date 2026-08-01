import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// M22 — Phát hiện & kiến nghị của cuộc kiểm tra; theo dõi khắc phục.
// status: OPEN | IN_PROGRESS | RESOLVED | ACCEPTED.
@Entity('inspection_findings')
@Index(['inspectionId'])
export class InspectionFinding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inspection_id', type: 'uuid' })
  inspectionId!: string;

  @Column()
  title!: string;

  // LOW | MEDIUM | HIGH | CRITICAL.
  @Column({ type: 'varchar', default: 'MEDIUM' })
  severity!: string;

  @Column({ type: 'text', nullable: true })
  recommendation!: string | null;

  @Column({ name: 'responsible_org_id', type: 'uuid', nullable: true })
  responsibleOrgId!: string | null;

  @Column({ name: 'responsible_area_id', type: 'uuid', nullable: true })
  responsibleAreaId!: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | null;

  @Index()
  @Column({ type: 'varchar', default: 'OPEN' })
  status!: string;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote!: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'linked_entity_type', type: 'varchar', nullable: true })
  linkedEntityType!: string | null;

  @Column({ name: 'linked_entity_id', type: 'uuid', nullable: true })
  linkedEntityId!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
