import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Đất QP cho thuê/mượn/liên doanh liên kết (biểu 04/KK-ĐQP). Một thửa có thể nhiều hợp đồng.
// Đối chiếu TT 35/2009/TT-BQP & 58/2021/TT-BQP; loại hợp đồng với BQP hoặc đơn vị tự ký.
@Entity('land_economic_use')
export class LandEconomicUse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'land_parcel_id', type: 'uuid' })
  landParcelId!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  area!: string;

  // Căn cứ pháp lý: TT35_2009 | TT58_2021 | HD_BQP_TT (HĐ với BQP theo TT) |
  // HD_BQP_CV (HĐ với BQP theo Công văn) | TU_KY (đơn vị tự ký hợp đồng).
  @Column({ name: 'legal_basis', type: 'varchar', default: 'TU_KY' })
  legalBasis!: string;

  // Trạng thái phê duyệt BQP: PHE_DUYET (đã duyệt phương án) | CHU_TRUONG (mới cho chủ trương) | KHONG.
  @Column({ name: 'bqp_status', type: 'varchar', default: 'KHONG' })
  bqpStatus!: string;

  @Column({ name: 'contract_no', type: 'varchar', nullable: true })
  contractNo!: string | null;

  @Column({ name: 'certificate_serie', type: 'varchar', nullable: true })
  certificateSerie!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
