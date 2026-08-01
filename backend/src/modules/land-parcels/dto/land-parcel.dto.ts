import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export const LAND_USE_TYPES = ['QUOC_PHONG', 'HON_HOP', 'KHAC'] as const;
export const USAGE_STATUSES = ['IN_USE', 'VACANT', 'PLANNED', 'RESERVE', 'LEASED'] as const;
export const LEGAL_STATUSES = ['CERTIFICATE', 'DECISION', 'PENDING', 'NONE'] as const;
export const DISPUTE_STATUSES = ['NONE', 'DISPUTED', 'ENCROACHED'] as const;
export const EXPANSION_LEVELS = ['NONE', 'LIMITED', 'GOOD'] as const;
export const SAFETY_STATUSES = ['SAFE', 'RISK', 'UNSAFE'] as const;

export class CreateLandParcelDto {
  @ApiProperty({ example: 'KD-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Khu đất Bộ CHQS tỉnh' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ description: 'UUID xã/phường/đặc khu' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị quản lý' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'UUID doanh trại gắn với khu đất' })
  @IsOptional()
  @IsUUID()
  barracksId?: string;

  @ApiPropertyOptional({ example: 'Phường Hạc Thành, TP Thanh Hóa' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 25000.5, description: 'Diện tích (m2)' })
  @IsOptional()
  @IsNumber()
  landArea?: number;

  @ApiPropertyOptional({ enum: LAND_USE_TYPES })
  @IsOptional()
  @IsIn(LAND_USE_TYPES as unknown as string[])
  landUseType?: string;

  @ApiPropertyOptional({ enum: USAGE_STATUSES })
  @IsOptional()
  @IsIn(USAGE_STATUSES as unknown as string[])
  usageStatus?: string;

  @ApiPropertyOptional({ enum: LEGAL_STATUSES })
  @IsOptional()
  @IsIn(LEGAL_STATUSES as unknown as string[])
  legalStatus?: string;

  @ApiPropertyOptional({ example: 'Bàn giao 1998 theo QĐ 123/QĐ-BQP' })
  @IsOptional()
  @IsString()
  legalOrigin?: string;

  @ApiPropertyOptional({ example: 'GCN số CT-0456' })
  @IsOptional()
  @IsString()
  certificateNo?: string;

  @ApiPropertyOptional({ enum: DISPUTE_STATUSES })
  @IsOptional()
  @IsIn(DISPUTE_STATUSES as unknown as string[])
  disputeStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  disputeNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessRoad?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasElectricity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasWater?: boolean;

  @ApiPropertyOptional({ enum: EXPANSION_LEVELS })
  @IsOptional()
  @IsIn(EXPANSION_LEVELS as unknown as string[])
  expansionCapability?: string;

  @ApiPropertyOptional({ enum: SAFETY_STATUSES })
  @IsOptional()
  @IsIn(SAFETY_STATUSES as unknown as string[])
  safetyStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'GeoJSON Point điểm đại diện', example: { type: 'Point', coordinates: [105.78, 19.8] } })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };

  @ApiPropertyOptional({ description: 'GeoJSON MultiPolygon ranh giới' })
  @IsOptional()
  @IsObject()
  boundary?: { type: 'MultiPolygon'; coordinates: number[][][][] };
}

// Cập nhật: mã khu đất cố định sau khi tạo.
export class UpdateLandParcelDto extends PartialType(CreateLandParcelDto) {}

export class ReviewDecisionDto {
  @ApiPropertyOptional({ example: 'Thiếu hồ sơ pháp lý đất.' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateMarkerDto {
  @ApiProperty({ example: 'M-01' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'GeoJSON Point', example: { type: 'Point', coordinates: [105.78, 19.8] } })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };
}
