import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CellState } from '../dt11.enums';

// Truy vết ô → nguồn (BR-DT11-002). Mỗi ô số liệu của báo cáo lưu 1 dòng: dataset_field, giá trị, cell_state,
// snapshot_ref (dataset→snapshot) + transaction/norm_ref (giao dịch/định mức) để drill-down.
@Entity('report_lineage')
@Index('IDX_lineage_report_cell', ['reportInstanceId', 'cellRef'])
export class ReportLineage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'report_instance_id', type: 'uuid' })
  reportInstanceId!: string;

  // Định danh ô: "rowKey:fieldKey".
  @Column({ name: 'cell_ref', type: 'varchar' })
  cellRef!: string;

  @Column({ name: 'dataset_field', type: 'varchar', nullable: true })
  datasetField!: string | null;

  @Column({ name: 'cell_state', type: 'varchar', default: CellState.VALUE })
  cellState!: CellState;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  value!: string | null;

  // { datasetInstanceId, datasetHash, sourceType, snapshotId?, snapshotVersion?, campaignId?/planId?/runId? }
  @Column({ name: 'snapshot_ref', type: 'jsonb', default: () => "'{}'::jsonb" })
  snapshotRef!: Record<string, unknown>;

  // { materialCatalogId?, lotId?, transactionRef?, normRef? }
  @Column({ name: 'transaction_ref', type: 'jsonb', default: () => "'{}'::jsonb" })
  transactionRef!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
