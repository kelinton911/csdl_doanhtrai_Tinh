import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// DT-12 Data Mart star schema (Quyển XII PHẦN XI). DẪN XUẤT từ snapshot chuẩn — refresh qua outbox,
// KHÔNG phải nguồn sự thật, KHÔNG sửa tay. Mỗi fact mang snapshot_ref để vẫn drill-down về nguồn.
// Dim/fact là bảng nhẹ (rebuild toàn phần khi refresh), không cần row_version.

// ---------------- Dimensions ----------------
@Entity('dim_time')
export class DimTime {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'date_key', type: 'date' })
  dateKey!: string;

  @Column({ name: 'iso_time', type: 'timestamptz', nullable: true })
  isoTime!: Date | null;
}

@Entity('dim_material')
export class DimMaterial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;
}

@Entity('dim_org')
export class DimOrg {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'org_id', type: 'uuid' })
  orgId!: string;
}

@Entity('dim_location')
export class DimLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'area_id', type: 'uuid' })
  areaId!: string;
}

@Entity('dim_mission')
export class DimMission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'mission_id', type: 'uuid' })
  missionId!: string;
}

@Entity('dim_quality')
export class DimQuality {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // C1..C5 (cấp chất lượng vật chất — DT-04/DT-10).
  @Index({ unique: true })
  @Column({ name: 'grade_code', type: 'varchar' })
  gradeCode!: string;
}

// ---------------- Facts ----------------
@Entity('fact_inventory')
export class FactInventory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'refresh_id', type: 'uuid' })
  refreshId!: string;

  @Index()
  @Column({ name: 'dim_material_id', type: 'uuid' })
  dimMaterialId!: string;

  @Column({ name: 'dim_org_id', type: 'uuid', nullable: true })
  dimOrgId!: string | null;

  @Column({ name: 'dim_time_id', type: 'uuid', nullable: true })
  dimTimeId!: string | null;

  @Column({ name: 'dim_quality_id', type: 'uuid', nullable: true })
  dimQualityId!: string | null;

  @Column({ name: 'on_hand', type: 'numeric', precision: 18, scale: 4, default: 0 })
  onHand!: string;

  @Column({ name: 'available', type: 'numeric', precision: 18, scale: 4, nullable: true })
  available!: string | null;

  @Column({ name: 'snapshot_ref', type: 'jsonb', default: () => "'{}'::jsonb" })
  snapshotRef!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('fact_requirement')
export class FactRequirement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'refresh_id', type: 'uuid' })
  refreshId!: string;

  @Index()
  @Column({ name: 'dim_material_id', type: 'uuid' })
  dimMaterialId!: string;

  @Column({ name: 'dim_time_id', type: 'uuid', nullable: true })
  dimTimeId!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  tt!: string | null;

  @Column({ name: 'pc_sscd', type: 'numeric', precision: 18, scale: 4, nullable: true })
  pcSscd!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  hc!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  nc!: string | null;

  @Column({ name: 'supply_required', type: 'numeric', precision: 18, scale: 4, nullable: true })
  supplyRequired!: string | null;

  @Column({ name: 'run_ref', type: 'jsonb', default: () => "'{}'::jsonb" })
  runRef!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('fact_balance')
export class FactBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'refresh_id', type: 'uuid' })
  refreshId!: string;

  @Index()
  @Column({ name: 'dim_material_id', type: 'uuid' })
  dimMaterialId!: string;

  @Column({ name: 'dim_time_id', type: 'uuid', nullable: true })
  dimTimeId!: string | null;

  @Column({ name: 'supply_required', type: 'numeric', precision: 18, scale: 4, nullable: true })
  supplyRequired!: string | null;

  @Column({ name: 'planned_source', type: 'numeric', precision: 18, scale: 4, nullable: true })
  plannedSource!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  gap!: string | null;

  @Column({ name: 'snapshot_ref', type: 'jsonb', default: () => "'{}'::jsonb" })
  snapshotRef!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity('fact_count')
export class FactCount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'refresh_id', type: 'uuid' })
  refreshId!: string;

  @Index()
  @Column({ name: 'dim_material_id', type: 'uuid' })
  dimMaterialId!: string;

  @Column({ name: 'dim_time_id', type: 'uuid', nullable: true })
  dimTimeId!: string | null;

  @Column({ name: 'official_qty', type: 'numeric', precision: 18, scale: 4, nullable: true })
  officialQty!: string | null;

  @Column({ name: 'snapshot_ref', type: 'jsonb', default: () => "'{}'::jsonb" })
  snapshotRef!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
