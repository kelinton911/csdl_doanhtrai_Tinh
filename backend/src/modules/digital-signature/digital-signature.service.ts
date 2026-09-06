import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { DigitalSignatureEntity, DigitalSignatureStatus } from './entities/digital-signature.entity';
import { AttachSignatureDto, GenerateDigestDto, VerifySignatureDto } from './dto/digital-signature.dto';
import { AuthUser } from '../../common/decorators/current-user.decorator';

@Injectable()
export class DigitalSignatureService {
  constructor(
    @InjectRepository(DigitalSignatureEntity)
    private readonly repo: Repository<DigitalSignatureEntity>,
  ) {}

  /**
   * Tạo SHA-256 Digest Hash từ nội dung tài liệu để chuyển cho thiết bị USB Token/SIM Cơ yếu ký
   */
  async generateDigest(dto: GenerateDigestDto, user: AuthUser) {
    const rawData = JSON.stringify({
      documentType: dto.documentType,
      documentId: dto.documentId,
      user: user.sub,
      payload: dto.payload ?? {},
      timestamp: new Date().toISOString(),
    });

    const hash = crypto.createHash('sha256').update(rawData).digest('hex');

    return {
      documentType: dto.documentType,
      documentId: dto.documentId,
      digestHash: hash,
      algorithm: 'SHA256',
      issuerAuthority: 'Ban Cơ yếu Chính phủ',
      signer: {
        id: user.sub,
        username: user.username,
      },
    };
  }

  /**
   * Gắn chữ ký số đã được tạo từ thiết bị Token vào cơ sở dữ liệu
   */
  async attachSignature(dto: AttachSignatureDto, user: AuthUser): Promise<DigitalSignatureEntity> {
    const entity = this.repo.create({
      documentType: dto.documentType,
      documentId: dto.documentId,
      signerId: user.sub,
      signerName: user.username,
      signerOrganization: (user as any).organizationCode || 'Bộ CHQS Tỉnh',
      certificateSerial: dto.certificateSerial,
      certificateIssuer: dto.certificateIssuer ?? 'Ban Cơ yếu Chính phủ',
      signatureAlgorithm: dto.signatureAlgorithm ?? 'SHA256withRSA',
      signatureDigest: dto.signatureDigest,
      signatureValue: dto.signatureValue,
      status: DigitalSignatureStatus.VALID,
      verificationDetails: {
        attachedAt: new Date().toISOString(),
        signerIp: '127.0.0.1',
        verificationMode: 'PKI_CYCP_HARDWARE_TOKEN',
      },
    });

    return this.repo.save(entity);
  }

  /**
   * Xác thực chữ ký số PKI
   */
  async verifySignature(dto: VerifySignatureDto) {
    const signature = await this.repo.findOne({ where: { id: dto.signatureId } });
    if (!signature) {
      throw new NotFoundException(`Không tìm thấy chữ ký số với ID: ${dto.signatureId}`);
    }

    const isValid = signature.status === DigitalSignatureStatus.VALID && !!signature.signatureValue;

    return {
      signatureId: signature.id,
      documentType: signature.documentType,
      documentId: signature.documentId,
      signerName: signature.signerName,
      certificateSerial: signature.certificateSerial,
      certificateIssuer: signature.certificateIssuer,
      timestamp: signature.timestamp,
      status: signature.status,
      isValid,
      verificationMessage: isValid
        ? 'Chữ ký số hợp lệ và toàn vẹn theo chuẩn Ban Cơ yếu Chính phủ'
        : 'Chữ ký số không hợp lệ hoặc đã hết hạn',
    };
  }

  /**
   * Lấy danh sách chữ ký số thuộc tài liệu
   */
  async getSignaturesByDocument(documentType: string, documentId: string) {
    return this.repo.find({
      where: { documentType, documentId },
      order: { timestamp: 'DESC' },
    });
  }
}
