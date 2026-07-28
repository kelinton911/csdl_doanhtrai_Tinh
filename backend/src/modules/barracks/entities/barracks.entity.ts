import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// Hồ sơ doanh trại (M04). Mã duy nhất toàn tỉnh; không xóa cứng khi đã phát sinh
// công trình/kiểm kê; bản APPROVED không sửa trực tiếp (tạo revision mới).
@Entity('barracks')
export class Barracks {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ name: 'declared_capacity', type: 'int', default: 0 })
  declaredCapacity!: number;

  // Điểm đại diện doanh trại (PostGIS Point, SRID 4326). Nullable ở giai đoạn giả lập.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: unknown;

  @Column({
    name: 'workflow_status',
    type: 'varchar',
    default: WorkflowStatus.DRAFT,
  })
  workflowStatus!: WorkflowStatus;

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
