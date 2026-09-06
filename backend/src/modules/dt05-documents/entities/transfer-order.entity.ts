import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { TransferStatus } from '../dt05.enums';

// Lệnh điều chuyển 2 đầu (Quyển V §X, BR-DT05-008). IN_TRANSIT không thuộc HC khả dụng
// bên nào cho tới khi nhận. Chênh lệch giao–nhận là exception.
@Entity('transfer_order')
export class TransferOrder extends AbstractEntity {
  @Index({ unique: true })
  @Column({ name: 'order_no', type: 'varchar' })
  orderNo!: string;

  @Index()
  @Column({ name: 'from_org', type: 'uuid' })
  fromOrg!: string;

  @Index()
  @Column({ name: 'to_org', type: 'uuid' })
  toOrg!: string;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'dispatched_qty', type: 'numeric', precision: 18, scale: 3, nullable: true })
  dispatchedQty!: string | null;

  @Column({ name: 'received_qty', type: 'numeric', precision: 18, scale: 3, nullable: true })
  receivedQty!: string | null;

  @Column({ name: 'dispatched_at', type: 'timestamptz', nullable: true })
  dispatchedAt!: Date | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @Index()
  @Column({ type: 'varchar', default: TransferStatus.DRAFT })
  status!: TransferStatus;

  // Chứng từ xuất (nguồn) và nhập (đích) tương ứng.
  @Column({ name: 'dispatch_document_id', type: 'uuid', nullable: true })
  dispatchDocumentId!: string | null;

  @Column({ name: 'receive_document_id', type: 'uuid', nullable: true })
  receiveDocumentId!: string | null;

  @Column({ name: 'discrepancy_note', type: 'text', nullable: true })
  discrepancyNote!: string | null;
}
