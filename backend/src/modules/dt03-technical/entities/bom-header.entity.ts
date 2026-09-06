import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// Đầu mục BOM (Quyển III §VIII) — tách khỏi tồn kho.
@Entity('bom_header')
export class BomHeader extends AbstractEntity {
  @Index()
  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId!: string;

  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
