import { Column, Entity, Index } from 'typeorm';
import { AbstractEntity } from '../../../common/entities/abstract.entity';

// DT-09 — Minh chứng đính kèm một lần xác minh (nhiều file/ảnh/biên bản).
@Entity('verification_evidence')
export class VerificationEvidence extends AbstractEntity {
  @Index()
  @Column({ name: 'verification_id', type: 'uuid' })
  verificationId!: string;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
