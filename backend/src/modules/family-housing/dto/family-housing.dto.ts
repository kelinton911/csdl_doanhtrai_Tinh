import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateFamilyHousingDto {
  @ApiProperty({ example: 'KGD-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Khu gia đình Trung đoàn X' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị quản lý' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'UUID xã/phường' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ example: 'Phường Lê Chân, TP Hải Phòng' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 12000, description: 'Tổng diện tích (m2)' })
  @IsOptional()
  @IsNumber()
  totalArea?: number;

  @ApiPropertyOptional({ example: 48, description: 'Số hộ gia đình' })
  @IsOptional()
  @IsInt()
  @Min(0)
  householdCount?: number;

  @ApiPropertyOptional({ example: 'Văn bản số 123 ngày 01/01/2000 của BTL QK3' })
  @IsOptional()
  @IsString()
  legalDoc?: string;

  @ApiPropertyOptional({ example: 'Chưa hoàn thiện hồ sơ pháp lý; vướng quy hoạch địa phương' })
  @IsOptional()
  @IsString()
  notHandedReason?: string;

  @ApiPropertyOptional({ example: 'Quý IV/2027' })
  @IsOptional()
  @IsString()
  plannedHandover?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Nguồn dữ liệu: SEED | REFERENCE_HAIPHONG_2026 | REAL' })
  @IsOptional()
  @IsString()
  dataSource?: string;
}

export class UpdateFamilyHousingDto extends PartialType(CreateFamilyHousingDto) {}
