import { MigrationInterface, QueryRunner } from 'typeorm';

export class DigitalSignature1753000033000 implements MigrationInterface {
  name = 'DigitalSignature1753000033000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "digital_signatures" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_type" varchar NOT NULL,
        "document_id" varchar NOT NULL,
        "signer_id" uuid NOT NULL,
        "signer_name" varchar NOT NULL,
        "signer_organization" varchar,
        "certificate_serial" varchar NOT NULL,
        "certificate_issuer" varchar NOT NULL DEFAULT 'Ban Cơ yếu Chính phủ',
        "signature_algorithm" varchar NOT NULL DEFAULT 'SHA256withRSA',
        "signature_digest" varchar NOT NULL,
        "signature_value" text NOT NULL,
        "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "status" varchar NOT NULL DEFAULT 'VALID',
        "verification_details" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_digital_signatures" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_digital_signatures_doc" ON "digital_signatures" ("document_type", "document_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_digital_signatures_signer" ON "digital_signatures" ("signer_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_digital_signatures_cert" ON "digital_signatures" ("certificate_serial")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "digital_signatures"');
  }
}
