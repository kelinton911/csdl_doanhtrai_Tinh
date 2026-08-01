import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

// M20 — Văn bản, tiêu chuẩn, định mức (sổ đăng ký văn bản pháp quy). Khác documents (M08)
// là tệp minh chứng đính kèm; tệp quét của văn bản gắn qua documents entityType='legal_document'.
@Entity('legal_documents')
export class LegalDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Mã nội bộ (định danh trong hệ thống).
  @Index({ unique: true })
  @Column()
  code!: string;

  // Số/ký hiệu văn bản (vd 2837/DT-QLDT, 15/2023/TT-BQP).
  @Index()
  @Column({ name: 'doc_number', type: 'varchar' })
  docNumber!: string;

  @Column()
  title!: string;

  // LAW | DECREE | CIRCULAR | DECISION | REGULATION | STANDARD | NORM | GUIDELINE | PLAN | OTHER.
  @Index()
  @Column({ name: 'doc_type', type: 'varchar', default: 'OTHER' })
  docType!: string;

  @Column({ name: 'issuing_body', type: 'varchar', nullable: true })
  issuingBody!: string | null;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate!: string | null;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate!: string | null;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate!: string | null;

  // DRAFT | EFFECTIVE | EXPIRED | SUPERSEDED | REVOKED.
  @Index()
  @Column({ name: 'effective_status', type: 'varchar', default: 'EFFECTIVE' })
  effectiveStatus!: string;

  // Lĩnh vực: DOANH_TRAI | DAT_DAI | VAT_CHAT | TAI_CHINH | XDCB | DIEN_NUOC | KIEM_TRA | CHUNG.
  @Index()
  @Column({ type: 'varchar', default: 'CHUNG' })
  field!: string;

  // Độ mật: PUBLIC | INTERNAL | CONFIDENTIAL | SECRET (phân quyền hiển thị).
  @Column({ type: 'varchar', default: 'INTERNAL' })
  confidentiality!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'text', nullable: true })
  keywords!: string | null;

  // Văn bản này thay thế văn bản nào (liên kết thay thế/sửa đổi).
  @Column({ name: 'supersedes_id', type: 'uuid', nullable: true })
  supersedesId!: string | null;

  @Column({ name: 'source_url', type: 'varchar', nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;
}
