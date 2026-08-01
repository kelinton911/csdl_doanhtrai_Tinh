import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

// Loại hệ thống → nhóm. Server suy nhóm từ kind để nhất quán (bỏ qua category client gửi).
export const KIND_CATEGORY: Record<string, 'ELECTRICITY' | 'WATER' | 'FUEL'> = {
  POWER_GRID: 'ELECTRICITY',
  TRANSFORMER: 'ELECTRICITY',
  GENERATOR: 'ELECTRICITY',
  POWER_INTERNAL: 'ELECTRICITY',
  WATER_SOURCE: 'WATER',
  WELL: 'WATER',
  WATER_TANK: 'WATER',
  WATER_TREATMENT: 'WATER',
  WATER_NETWORK: 'WATER',
  FUEL_TANK: 'FUEL',
};
export const UTILITY_KINDS = Object.keys(KIND_CATEGORY);
export const UTILITY_STATUSES = ['OPERATIONAL', 'STANDBY', 'MAINTENANCE', 'FAULT', 'DECOMMISSIONED'] as const;

export class CreateUtilitySystemDto {
  @ApiProperty({ example: 'HT-DIEN-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Trạm biến áp 250kVA' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ enum: UTILITY_KINDS })
  @IsIn(UTILITY_KINDS)
  kind!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() barracksId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;

  @ApiPropertyOptional({ example: 250 }) @IsOptional() @IsNumber() capacity?: number;
  @ApiPropertyOptional({ example: 'kVA' }) @IsOptional() @IsString() capacityUnit?: string;
  @ApiPropertyOptional({ example: 500 }) @IsOptional() @IsNumber() reserveVolume?: number;
  @ApiPropertyOptional({ example: 'm3' }) @IsOptional() @IsString() reserveUnit?: string;
  @ApiPropertyOptional({ example: 'DIESEL' }) @IsOptional() @IsString() fuelType?: string;
  @ApiPropertyOptional({ example: 800 }) @IsOptional() @IsNumber() fuelLevel?: number;
  @ApiPropertyOptional({ example: 48 }) @IsOptional() @IsNumber() autonomyHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() meterNo?: string;

  @ApiPropertyOptional({ enum: UTILITY_STATUSES })
  @IsOptional()
  @IsIn(UTILITY_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsString() lastMaintenanceAt?: string;
  @ApiPropertyOptional({ description: 'ISO date' }) @IsOptional() @IsString() nextMaintenanceAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'GeoJSON Point', example: { type: 'Point', coordinates: [105.78, 19.8] } })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };
}

export class UpdateUtilitySystemDto extends PartialType(CreateUtilitySystemDto) {}

export class DecommissionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CreateReadingDto {
  @ApiProperty({ example: '2026-07-01', description: 'Ngày ghi (YYYY-MM-DD)' })
  @IsString()
  readingDate!: string;

  @ApiPropertyOptional({ example: 12450 }) @IsOptional() @IsNumber() indexValue?: number;
  @ApiPropertyOptional({ example: 320 }) @IsOptional() @IsNumber() consumption?: number;
  @ApiPropertyOptional({ example: 850000 }) @IsOptional() @IsNumber() cost?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class UtilityListQueryBase {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() kind?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() barracksId?: string;
  @ApiPropertyOptional() @IsOptional() @Min(1) @IsInt() page?: number;
}
