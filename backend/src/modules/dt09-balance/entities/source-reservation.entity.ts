import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { ReservationStatus } from '../dt09.enums';

// DT-09 — Giữ chỗ nguồn cho một dòng cân đối (BR-DT09-008). Chỉ ACTIVE tính vào Σ chống overbooking.
// row_version (AbstractEntity) dùng optimistic lock khi release/cập nhật.
@Entity('source_reservation')
export class SourceReservation extends AbstractEntity {
  @Index()
  @Column({ name: 'balance_line_id', type: 'uuid' })
  balanceLineId!: string;

  @Index()
  @Column({ name: 'source_material_id', type: 'uuid' })
  sourceMaterialId!: string;

  @Column({ name: 'reserved_qty', type: 'numeric', precision: 18, scale: 3 })
  reservedQty!: string;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Index()
  @Column({ type: 'varchar', default: ReservationStatus.ACTIVE })
  status!: ReservationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;
}
