import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkflowStatus } from '../../../common/workflow';

// Kho / địa điểm lưu giữ vật chất (M06). Có workflow duyệt như doanh trại:
// xã khai báo (DRAFT) → gửi duyệt (PENDING_REVIEW) → chỉ huy xã duyệt (APPROVED).
@Entity('storage_locations')
export class StorageLocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column()
  code!: string;

  @Column()
  name!: string;

  // Loại kho (tham chiếu catalogs.type='storage-location-type').
  @Column({ name: 'type', type: 'varchar', nullable: true })
  type!: string | null;

  // Kho có thể thuộc một doanh trại.
  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  // Địa bàn xã/phường + đơn vị quản lý (gắn trực tiếp để lọc theo phạm vi dữ liệu
  // như doanh trại — kho có thể độc lập, không thuộc doanh trại nào).
  @Index()
  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // Vị trí kho trên bản đồ (PostGIS Point, SRID 4326). Nullable khi chưa có toạ độ.
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: unknown;

  @Column({ default: 'ACTIVE' })
  status!: string;

  // Trạng thái workflow duyệt hồ sơ kho.
  @Index()
  @Column({ name: 'workflow_status', type: 'varchar', default: WorkflowStatus.DRAFT })
  workflowStatus!: WorkflowStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
