import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// M11 — Kỳ ghi chỉ số công tơ điện/đồng hồ nước: chỉ số, mức tiêu thụ, chi phí/hóa đơn.
@Entity('utility_readings')
@Index(['utilitySystemId', 'readingDate'])
export class UtilityReading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'utility_system_id', type: 'uuid' })
  utilitySystemId!: string;

  @Column({ name: 'reading_date', type: 'date' })
  readingDate!: string;

  // Chỉ số công tơ tại kỳ (kWh/m3). Mức tiêu thụ = chỉ số kỳ này − kỳ trước (nếu có).
  @Column({ name: 'index_value', type: 'numeric', precision: 14, scale: 2, nullable: true })
  indexValue!: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  consumption!: string | null;

  // Chi phí/hóa đơn kỳ (VND).
  @Column({ type: 'numeric', precision: 16, scale: 2, nullable: true })
  cost!: string | null;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
