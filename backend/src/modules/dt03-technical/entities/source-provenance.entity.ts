import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TechVerificationStatus } from '../tech.enums';

// Truy nguồn + nhật ký xác minh dữ liệu trích (Quyển III §VIII, BR-DT03-006).
// Gắn cho mọi giá trị VERIFIED để truy nguồn tới tờ/trang.
@Entity('source_provenance')
export class SourceProvenance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'entity_type', type: 'varchar' })
  entityType!: string; // technical_attribute | bom_item | drawing_sheet | ...

  @Index()
  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ name: 'source_file', type: 'varchar', nullable: true })
  sourceFile!: string | null;

  @Column({ name: 'source_page', type: 'int', nullable: true })
  sourcePage!: number | null;

  @Column({ name: 'extraction_method', type: 'varchar', nullable: true })
  extractionMethod!: string | null; // OCR | MANUAL | IMPORT

  @Column({ name: 'confidence_level', type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidenceLevel!: string | null;

  @Column({ name: 'verification_status', type: 'varchar', default: TechVerificationStatus.DRAFT_EXTRACTED })
  verificationStatus!: TechVerificationStatus;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
