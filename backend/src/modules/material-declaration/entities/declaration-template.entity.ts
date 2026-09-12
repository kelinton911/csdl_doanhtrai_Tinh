import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Biểu mẫu định mức: bộ mã vật chất chuẩn (items) để nạp nhanh vào bản khai báo.
@Entity('declaration_templates')
export class DeclarationTemplate extends AbstractEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  // [{ materialCatalogId, label }] — label = "mã — tên" để hiển thị khi áp dụng.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  items!: Array<{ materialCatalogId: string; label: string }>;
}
