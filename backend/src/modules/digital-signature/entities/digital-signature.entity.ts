import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DigitalSignatureStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  INVALID = 'INVALID',
}

@Entity('digital_signatures')
@Index(['documentType', 'documentId'])
export class DigitalSignatureEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_type', type: 'varchar' })
  documentType!: string;

  @Column({ name: 'document_id', type: 'varchar' })
  documentId!: string;

  @Column({ name: 'signer_id', type: 'uuid' })
  signerId!: string;

  @Column({ name: 'signer_name', type: 'varchar' })
  signerName!: string;

  @Column({ name: 'signer_organization', type: 'varchar', nullable: true })
  signerOrganization?: string;

  @Column({ name: 'certificate_serial', type: 'varchar' })
  certificateSerial!: string;

  @Column({ name: 'certificate_issuer', type: 'varchar', default: 'Ban Cơ yếu Chính phủ' })
  certificateIssuer!: string;

  @Column({ name: 'signature_algorithm', type: 'varchar', default: 'SHA256withRSA' })
  signatureAlgorithm!: string;

  @Column({ name: 'signature_digest', type: 'varchar' })
  signatureDigest!: string;

  @Column({ name: 'signature_value', type: 'text' })
  signatureValue!: string;

  @Column({ name: 'timestamp', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp!: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DigitalSignatureStatus,
    default: DigitalSignatureStatus.VALID,
  })
  status!: DigitalSignatureStatus;

  @Column({ name: 'verification_details', type: 'jsonb', nullable: true })
  verificationDetails?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
