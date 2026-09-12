import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Dòng VẬT CHẤT tiềm lực HC-KT địa phương trong một bản khai tiềm lực cấp xã (KVPT).
// Chọn theo danh mục chuẩn (material_catalog) — kết hợp version chuẩn (R00/Quân nhu) và
// nhóm "Tiềm lực địa phương". catalogGroup đánh dấu nguồn để cuộn KVPT cấp Tỉnh.
@Entity('commune_potential_materials')
@Index(['communePotentialId'])
export class CommunePotentialMaterial extends AbstractEntity {
  @Column({ name: 'commune_potential_id', type: 'uuid' })
  communePotentialId!: string;

  // Mã chuẩn (material_catalog.id).
  @Index()
  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  // Tên gọi khác người nhập đã dùng để tra ra mã chuẩn — lưu vết.
  @Column({ name: 'alias_used', type: 'varchar', nullable: true })
  aliasUsed!: string | null;

  // ĐVT (unit_of_measure.id) — mặc định theo catalog nếu bỏ trống.
  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId!: string | null;

  // Nguồn danh mục: STANDARD (danh mục chuẩn) | LOCAL_POTENTIAL (tiềm lực địa phương).
  @Column({ name: 'catalog_group', type: 'varchar', default: 'STANDARD' })
  catalogGroup!: string;

  @Column({ type: 'numeric', precision: 18, scale: 3, default: 0 })
  quantity!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;
}
