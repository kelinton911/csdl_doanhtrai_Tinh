import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// Danh mục dùng chung phiên bản hóa (M03/UC-03). Mã duy nhất trong từng loại (type).
// Không sửa hồi tố bản đã phát hành; mã đã dùng chỉ ngừng hiệu lực, không xóa cứng.
@Entity('catalogs')
@Index(['type', 'code'], { unique: true })
export class Catalog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Loại danh mục: unit-of-measure | material-category | facility-type |
  // quality-grade | damage-cause | storage-location-type | organization-type ...
  @Index()
  @Column()
  type!: string;

  @Column()
  code!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  // Danh mục cha-con (ví dụ nhóm vật chất phân cấp).
  @Column({ name: 'parent_code', type: 'varchar', nullable: true })
  parentCode!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'int', default: 1 })
  version!: number;

  // DRAFT | PUBLISHED | INACTIVE
  @Column({ default: 'DRAFT' })
  status!: string;

  @Column({ name: 'effective_from', type: 'timestamptz', nullable: true })
  effectiveFrom!: Date | null;

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
