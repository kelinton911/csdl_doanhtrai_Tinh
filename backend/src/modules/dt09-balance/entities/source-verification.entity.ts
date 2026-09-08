import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';
import { VerificationStatus } from '../dt09.enums';

// DT-09 — Bản ghi xác minh nguồn vật chất (BR-DT09-001/002). Mỗi lần xác minh là 1 bản ghi;
// bản MỚI NHẤT (created_at) là hiện hành. Trạng thái hiệu lực tính tại đọc: VERIFIED nhưng
// expires_at < now ⇒ coi EXPIRED. VERIFIED ≠ ELIGIBLE (còn cần huy động + lead_time).
@Entity('source_verification')
export class SourceVerification extends AbstractEntity {
  @Index()
  @Column({ name: 'source_material_id', type: 'uuid' })
  sourceMaterialId!: string;

  @Column({ type: 'varchar', default: VerificationStatus.UNVERIFIED })
  status!: VerificationStatus;

  @Column({ name: 'verified_qty', type: 'numeric', precision: 18, scale: 3, nullable: true })
  verifiedQty!: string | null;

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy!: string | null;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  // File minh chứng chính (evidence bổ sung ở verification_evidence).
  @Column({ name: 'evidence_file_id', type: 'uuid', nullable: true })
  evidenceFileId!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  method!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
