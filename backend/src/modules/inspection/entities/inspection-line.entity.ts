import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Dòng kiểm kê (M07). Đối tượng là vật chất hoặc công trình; ghi số hiện trạng + chênh lệch.
@Entity('inspection_lines')
export class InspectionLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'sheet_id', type: 'uuid' })
  sheetId!: string;

  // MATERIAL | FACILITY
  @Column({ name: 'item_type', type: 'varchar' })
  itemType!: string;

  @Column({ name: 'item_ref', type: 'uuid', nullable: true })
  itemRef!: string | null;

  @Column()
  label!: string;

  @Column({ name: 'unit_code', type: 'varchar', nullable: true })
  unitCode!: string | null;

  @Column({ name: 'expected_quantity', type: 'numeric', precision: 18, scale: 3, nullable: true })
  expectedQuantity!: string | null;

  @Column({ name: 'counted_quantity', type: 'numeric', precision: 18, scale: 3, nullable: true })
  countedQuantity!: string | null;

  // Cấp chất lượng ghi nhận (với công trình).
  @Column({ type: 'varchar', nullable: true })
  condition!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;
}
