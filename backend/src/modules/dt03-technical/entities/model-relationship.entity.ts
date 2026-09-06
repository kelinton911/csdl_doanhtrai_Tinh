import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ActiveStatus } from '../../catalog/catalog.enums';
import { ModelRelationshipType } from '../tech.enums';

// Quan hệ giữa mẫu (Quyển III §VIII, BR-DT03-013): thay thế (2016↔K24)/tương đương.
// Phải có căn cứ, không suy từ tên gần giống; không tạo vòng lặp (cưỡng chế ở service).
@Entity('model_relationship')
export class ModelRelationship extends AbstractEntity {
  @Index()
  @Column({ name: 'source_model_id', type: 'uuid' })
  sourceModelId!: string;

  @Index()
  @Column({ name: 'target_model_id', type: 'uuid' })
  targetModelId!: string;

  @Column({ name: 'relationship_type', type: 'varchar' })
  relationshipType!: ModelRelationshipType;

  @Column({ name: 'basis_document_id', type: 'uuid', nullable: true })
  basisDocumentId!: string | null;

  @Column({ type: 'varchar', default: ActiveStatus.ACTIVE })
  status!: ActiveStatus;
}
