import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { WorkflowStatus } from '../../../common/workflow';

// Bản khai báo vật chất của cấp xã / đơn vị trực thuộc Tỉnh (aggregate root).
// Đơn vị toàn quyền nhập khi DRAFT/CHANGES_REQUESTED; APPROVED → khóa (bất biến).
// Muốn sửa sau duyệt phải qua declaration_amendment_requests.
@Entity('material_declarations')
export class MaterialDeclaration extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  title!: string;

  // Đơn vị/địa bàn sở hữu bản khai báo — KHÓA phạm vi dữ liệu (SYS-BR-08).
  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  // Kho/địa điểm lưu giữ (liên kết M06 storage_locations) — tùy chọn.
  @Column({ name: 'storage_location_id', type: 'uuid', nullable: true })
  storageLocationId!: string | null;

  // Doanh trại gắn bản khai báo (tùy chọn) — để lập & xem theo từng doanh trại.
  @Index()
  @Column({ name: 'barracks_id', type: 'uuid', nullable: true })
  barracksId!: string | null;

  // Kỳ khai báo (vd "Quý I/2026") — tự do, phục vụ lọc/hiển thị.
  @Column({ name: 'period_label', type: 'varchar', nullable: true })
  periodLabel!: string | null;

  @Index()
  @Column({ name: 'workflow_status', type: 'varchar', default: WorkflowStatus.DRAFT })
  workflowStatus!: WorkflowStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy!: string | null;
}
