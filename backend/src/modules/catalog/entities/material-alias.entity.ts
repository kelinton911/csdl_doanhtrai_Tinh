import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ActiveStatus, AliasType } from '../catalog.enums';

// Tên khác của vật chất (Quyển I §VIII, BR-DT01-009) — tra mã chuẩn từ alias.
@Entity('material_alias')
export class MaterialAlias extends AbstractEntity {
  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Index()
  @Column({ name: 'alias_name', type: 'varchar' })
  aliasName!: string;

  // Chuẩn hóa (bỏ dấu, hạ chữ) để so khớp — lưu sẵn phục vụ tìm kiếm nhanh.
  @Index()
  @Column({ name: 'alias_normalized', type: 'varchar' })
  aliasNormalized!: string;

  @Column({ name: 'alias_code', type: 'varchar', nullable: true })
  aliasCode!: string | null;

  @Column({ name: 'alias_type', type: 'varchar', default: AliasType.COMMON })
  aliasType!: AliasType;

  @Column({ type: 'varchar', nullable: true })
  source!: string | null;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;
}
