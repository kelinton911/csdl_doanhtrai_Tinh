import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M22 — Cuộc kiểm tra / thanh tra (tuân thủ), khác kiểm kê tài sản (module inspection).
// Vòng đời: PLANNED → IN_PROGRESS → REPORTED → CLOSED; hoặc CANCELLED.
@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  title!: string;

  // PERIODIC | SURPRISE | THEMATIC | AUDIT | SUPERIOR.
  @Column({ name: 'inspection_type', type: 'varchar', default: 'PERIODIC' })
  inspectionType!: string;

  @Column({ type: 'text', nullable: true })
  scope!: string | null;

  // Đối tượng được kiểm tra.
  @Column({ name: 'target_org_id', type: 'uuid', nullable: true })
  targetOrgId!: string | null;

  @Column({ name: 'target_area_id', type: 'uuid', nullable: true })
  targetAreaId!: string | null;

  @Column({ name: 'target_barracks_id', type: 'uuid', nullable: true })
  targetBarracksId!: string | null;

  @Column({ name: 'lead_name', type: 'varchar', nullable: true })
  leadName!: string | null;

  @Column({ name: 'team_note', type: 'text', nullable: true })
  teamNote!: string | null;

  @Column({ name: 'planned_date', type: 'date', nullable: true })
  plannedDate!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Index()
  @Column({ type: 'varchar', default: 'PLANNED' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  conclusion!: string | null;

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
