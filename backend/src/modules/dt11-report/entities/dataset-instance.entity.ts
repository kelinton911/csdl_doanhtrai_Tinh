import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { DatasetInstanceStatus, ValidationCheckType, ValidationStatus } from '../dt11.enums';

// Bản sinh dataset từ snapshot chuẩn (BR-DT11-006). dataset_hash chốt nội dung (cùng nguồn ⇒ trùng hash);
// source_fingerprint truy vết nguồn (checksum/hash thượng nguồn). payload_json giữ rows đã chuẩn hóa + cell_state.
@Entity('dataset_instance')
export class DatasetInstance extends AbstractEntity {
  @Index()
  @Column({ name: 'dataset_definition_id', type: 'uuid' })
  datasetDefinitionId!: string;

  // { sourceType, campaignId?/planId?/runId?/snapshotId?, snapshotVersion?, formCode? }
  @Column({ name: 'source_snapshot_ref', type: 'jsonb', default: () => "'{}'::jsonb" })
  sourceSnapshotRef!: Record<string, unknown>;

  @Index()
  @Column({ name: 'dataset_hash', type: 'varchar' })
  datasetHash!: string;

  @Column({ name: 'source_fingerprint', type: 'varchar' })
  sourceFingerprint!: string;

  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'now()' })
  generatedAt!: Date;

  @Column({ type: 'varchar', default: DatasetInstanceStatus.GENERATED })
  status!: DatasetInstanceStatus;

  @Column({ name: 'scope_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  scopeJson!: Record<string, unknown>;

  // { engineVersion, sourceTotals, rows:[{ cells:{[field]:{value,state}}, refs:{...} }] }
  @Column({ name: 'payload_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  payloadJson!: Record<string, unknown>;

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount!: number;
}

// Kết quả validate dataset (BR-DT11-007/009). status=FAIL ⇒ chặn phê duyệt report dùng dataset này.
@Entity('dataset_validation')
export class DatasetValidation extends AbstractEntity {
  @Index()
  @Column({ name: 'dataset_instance_id', type: 'uuid' })
  datasetInstanceId!: string;

  @Column({ name: 'check_type', type: 'varchar' })
  checkType!: ValidationCheckType;

  @Column({ type: 'varchar' })
  status!: ValidationStatus;

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ name: 'details_json', type: 'jsonb', default: () => "'{}'::jsonb" })
  detailsJson!: Record<string, unknown>;
}
