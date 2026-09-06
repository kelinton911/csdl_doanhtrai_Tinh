import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DigitalSignatureStatus } from '../entities/digital-signature.entity';

export class GenerateDigestDto {
  @ApiProperty({ description: 'Loại tài liệu (INSPECTION_SHEET, MAINTENANCE_REQUEST, BARRACKS_RECORD)' })
  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @ApiProperty({ description: 'ID tài liệu cần tạo digest hash' })
  @IsString()
  @IsNotEmpty()
  documentId!: string;

  @ApiPropertyOptional({ description: 'Nội dung bổ sung hoặc payload của tài liệu' })
  @IsOptional()
  payload?: Record<string, unknown>;
}

export class AttachSignatureDto {
  @ApiProperty({ description: 'Loại tài liệu' })
  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @ApiProperty({ description: 'ID tài liệu' })
  @IsString()
  @IsNotEmpty()
  documentId!: string;

  @ApiProperty({ description: 'Serial của chứng thư số PKI' })
  @IsString()
  @IsNotEmpty()
  certificateSerial!: string;

  @ApiPropertyOptional({ description: 'Cơ quan cấp chứng thư (mặc định Ban Cơ yếu Chính phủ)' })
  @IsString()
  @IsOptional()
  certificateIssuer?: string;

  @ApiProperty({ description: 'Giá trị digest hash SHA-256' })
  @IsString()
  @IsNotEmpty()
  signatureDigest!: string;

  @ApiProperty({ description: 'Chuỗi chữ ký số đã được ký từ USB Token / SIM PKI' })
  @IsString()
  @IsNotEmpty()
  signatureValue!: string;

  @ApiPropertyOptional({ description: 'Thuật toán ký (mặc định SHA256withRSA)' })
  @IsString()
  @IsOptional()
  signatureAlgorithm?: string;
}

export class VerifySignatureDto {
  @ApiProperty({ description: 'ID của bản ghi chữ ký số' })
  @IsString()
  @IsNotEmpty()
  signatureId!: string;

  @ApiPropertyOptional({ description: 'Mã xác thực nâng cao nếu có' })
  @IsString()
  @IsOptional()
  verificationCode?: string;
}
