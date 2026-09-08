import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { SheetStatus } from '../dt10.enums';

// Lớp PHYSICAL: phiếu kiểm đếm thực tế (blind — KHÔNG hiển thị/không lưu book_qty). current_round
// tăng theo recount (BR-DT10-008 — vòng mới, không ghi đè). status theo SHEET_TRANSITIONS.
@Entity('count_sheet')
export class CountSheet extends AbstractEntity {
  @Index()
  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;

  @Column({ name: 'assignee', type: 'uuid', nullable: true })
  assignee!: string | null;

  @Column({ name: 'current_round', type: 'int', default: 1 })
  currentRound!: number;

  @Index()
  @Column({ type: 'varchar', default: SheetStatus.DRAFT })
  status!: SheetStatus;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}

// Dòng kiểm đếm — chỉ physical_qty theo (material/lot/location). round_no giữ nguyên các vòng trước
// (blind count: KHÔNG có cột book_qty ở đây — lớp Book & Physical độc lập, BR-DT10-005).
@Entity('count_line')
export class CountLine extends AbstractEntity {
  @Index()
  @Column({ name: 'sheet_id', type: 'uuid' })
  sheetId!: string;

  @Column({ name: 'round_no', type: 'int', default: 1 })
  roundNo!: number;

  @Column({ name: 'material_catalog_id', type: 'uuid' })
  materialCatalogId!: string;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId!: string | null;

  @Column({ name: 'physical_qty', type: 'numeric', precision: 18, scale: 3, default: 0 })
  physicalQty!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
