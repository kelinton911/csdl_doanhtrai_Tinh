import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { QualityGrade } from '../../common/enums';
import { InventoryDocumentType } from './dt05.enums';

export class CreateDocumentDto {
  @ApiProperty({ enum: InventoryDocumentType }) @IsEnum(InventoryDocumentType) documentType!: InventoryDocumentType;
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiProperty({ description: 'Ngày hiệu lực (YYYY-MM-DD)' }) @IsString() effectiveDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterpartyOrgId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() basisDocumentId?: string;
}

export class AddLineDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsNumber() quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromLocationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toLocationId?: string;
  @ApiPropertyOptional({ enum: QualityGrade }) @IsOptional() @IsEnum(QualityGrade) qualityGrade?: QualityGrade;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CreateTransferDto {
  @ApiProperty() @IsUUID() fromOrg!: string;
  @ApiProperty() @IsUUID() toOrg!: string;
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsNumber() quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
}

export class ReceiveTransferDto {
  @ApiProperty() @IsNumber() receivedQty!: number;
}

export class CreatePeriodDto {
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiProperty() @IsString() periodFrom!: string;
  @ApiProperty() @IsString() periodTo!: string;
}

export class UnlockPeriodDto {
  @ApiProperty() @IsString() reason!: string;
}
