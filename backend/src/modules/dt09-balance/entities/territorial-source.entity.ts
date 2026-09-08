import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// DT-09 — Hồ sơ nguồn khai thác tại chỗ theo xã/điểm (DT-02). Không xóa cứng → status INACTIVE.
// admin_unit_id: đơn vị hành chính (xã/điểm) mà nguồn thuộc về. local_resource_id: liên kết
// tùy chọn tới master-data M16 (nguồn đã khảo sát).
@Entity('territorial_source')
export class TerritorialSource extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'source_code', type: 'varchar' })
  sourceCode!: string;

  @Column({ type: 'varchar' })
  name!: string;

  // Xã/điểm (DT-02) — bắt buộc để cân đối theo địa bàn.
  @Index()
  @Column({ name: 'admin_unit_id', type: 'uuid' })
  adminUnitId!: string;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId!: string | null;

  // Loại nguồn: SUPPLIER | WAREHOUSE | FARM | FACTORY | MARKET | OTHER…
  @Column({ name: 'source_type', type: 'varchar' })
  sourceType!: string;

  @Column({ name: 'owner_name', type: 'varchar', nullable: true })
  ownerName!: string | null;

  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone!: string | null;

  @Column({ type: 'varchar', nullable: true })
  address!: string | null;

  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  location!: unknown;

  // Liên kết tùy chọn tới local_resources (M16).
  @Column({ name: 'local_resource_id', type: 'uuid', nullable: true })
  localResourceId!: string | null;

  // ACTIVE | INACTIVE.
  @Index()
  @Column({ type: 'varchar', default: 'ACTIVE' })
  status!: string;

  // Cửa sổ hiệu lực của hồ sơ nguồn.
  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom!: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}
