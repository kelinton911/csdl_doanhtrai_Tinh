import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { DocumentStatus } from '../../../common/enums';
import { InventoryDocumentType } from '../dt05.enums';

// Chứng từ nghiệp vụ (Quyển V §X). 1 chứng từ → N dòng → N movement DT-04 (posting nguyên tử).
// POSTED bất biến → reversal (BR-DT05-002); hủy chỉ khi chưa POST (BR-DT05-003).
@Entity('inventory_document')
export class InventoryDocument extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'document_no', type: 'varchar' })
  documentNo!: string;

  @Column({ name: 'document_type', type: 'varchar' })
  documentType!: InventoryDocumentType;

  @Index()
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ name: 'counterparty_org_id', type: 'uuid', nullable: true })
  counterpartyOrgId!: string | null;

  @Column({ name: 'basis_document_id', type: 'uuid', nullable: true })
  basisDocumentId!: string | null;

  @Index()
  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate!: string;

  @Index()
  @Column({ type: 'varchar', default: DocumentStatus.DRAFT })
  status!: DocumentStatus;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt!: Date | null;

  @Column({ name: 'posting_batch_id', type: 'uuid', nullable: true })
  postingBatchId!: string | null;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId!: string | null;
}
