import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { MovementType } from './materiel-rules';
import { QualityGrade } from '../../common/enums';

export class CreateLotDto {
  @ApiProperty() @IsString() lotCode!: string;
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productRevisionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() primaryLocationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() receivedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() manufactureYear?: string;
}

export class CreateAssetDto {
  @ApiProperty() @IsString() assetCode!: string;
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productRevisionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() serialNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional({ enum: QualityGrade }) @IsOptional() @IsEnum(QualityGrade) qualityCurrent?: QualityGrade;
  @ApiPropertyOptional() @IsOptional() @IsString() qrValue?: string;
}

export class CreateMovementDto {
  @ApiProperty({ enum: MovementType }) @IsEnum(MovementType) transactionType!: MovementType;
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiProperty({ description: 'Số lượng (dương; ADJUSTMENT dùng dấu delta)' }) @IsNumber() quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assetId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fromLocationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() toLocationId?: string;
  @ApiPropertyOptional({ description: 'ISO-8601; mặc định hiện tại' }) @IsOptional() @IsString() effectiveTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reasonCode?: string;
}

export class CreateQualityDto {
  @ApiProperty() @IsUUID() lotId!: string;
  @ApiProperty({ enum: QualityGrade }) @IsEnum(QualityGrade) grade!: QualityGrade;
  @ApiProperty() @IsNumber() quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() assessmentTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() basisDocumentId?: string;
}

export class CreateSnapshotDto {
  @ApiProperty() @IsString() snapshotCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() asOfTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
}

export class CreateAdjustmentDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiProperty({ description: 'Số lượng đề nghị (mục tiêu)' }) @IsNumber() proposedQty!: number;
  @ApiProperty() @IsString() reasonCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
}
