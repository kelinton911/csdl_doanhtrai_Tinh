import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AddressOwnerType } from '../dt02.enums';

// Ảnh chụp địa chỉ tại một thời điểm (Quyển II §VIII, BR-DT02-001/023). BẢO TOÀN địa chỉ
// lịch sử có huyện/quận (district_text_legacy) mà KHÔNG tạo tầng tổ chức huyện. Append-only.
@Entity('address_snapshot')
export class AddressSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'owner_type', type: 'varchar' })
  ownerType!: AddressOwnerType;

  @Index()
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @Column({ name: 'province_text', type: 'varchar', nullable: true })
  provinceText!: string | null;

  // Huyện/quận chỉ lưu dạng văn bản lịch sử — KHÔNG dùng làm node tổ chức (BR-DT02-001).
  @Column({ name: 'district_text_legacy', type: 'varchar', nullable: true })
  districtTextLegacy!: string | null;

  @Column({ name: 'commune_text', type: 'varchar', nullable: true })
  communeText!: string | null;

  @Column({ name: 'detail_text', type: 'varchar', nullable: true })
  detailText!: string | null;

  @Column({ name: 'effective_at', type: 'date' })
  effectiveAt!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
