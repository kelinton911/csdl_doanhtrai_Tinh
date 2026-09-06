import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ActiveStatus } from '../catalog.enums';

// Liên kết mã danh mục ↔ mẫu kỹ thuật DT-03 (Quyển I §VIII). Tạo cột sẵn, nối khi mở DT-03.
@Entity('catalog_model_link')
export class CatalogModelLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  // product_model.id của DT-03 (chưa ràng buộc FK cứng cho tới khi DT-03 mở).
  @Column({ name: 'product_model_id', type: 'uuid' })
  productModelId!: string;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom!: string | null;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo!: string | null;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
