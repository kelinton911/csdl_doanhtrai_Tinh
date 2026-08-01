import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

// Loại nguồn lực → nhóm (server suy để nhất quán, bỏ qua category client gửi).
export const RESOURCE_TYPE_CATEGORY: Record<string, string> = {
  LODGING: 'FACILITY',
  WAREHOUSE: 'FACILITY',
  WORKSHOP: 'FACILITY',
  SCHOOL_HALL: 'FACILITY',
  OPEN_LAND: 'FACILITY',
  POWER_BACKUP: 'UTILITY',
  WATER_SOURCE: 'UTILITY',
  GENERATOR: 'UTILITY',
  PUMP: 'UTILITY',
  BUILDING_MATERIAL: 'MATERIAL',
  MATERIAL_FACTORY: 'MATERIAL',
  SUPPLY_FURNITURE: 'MATERIAL',
  CONSTRUCTION_EQUIP: 'EQUIPMENT',
  TECH_TEAM: 'SERVICE',
  CONSTRUCTION_FIRM: 'SERVICE',
  REPAIR_SHOP: 'SERVICE',
  OTHER: 'OTHER',
};
export const RESOURCE_TYPES = Object.keys(RESOURCE_TYPE_CATEGORY);
export const OWNER_TYPES = ['STATE', 'ENTERPRISE', 'PRIVATE', 'INDIVIDUAL'] as const;
export const MOBILIZATION_TIMES = ['IMMEDIATE', 'SHORT', 'MEDIUM', 'LONG'] as const;
export const RELIABILITIES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export const AGREEMENT_STATUSES = ['NONE', 'SIGNED', 'EXPIRED'] as const;

export class CreateLocalResourceDto {
  @ApiProperty({ example: 'NL-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Nhà kho Công ty XYZ' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ enum: RESOURCE_TYPES })
  @IsIn(RESOURCE_TYPES)
  resourceType!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() ownerName?: string;
  @ApiPropertyOptional({ enum: OWNER_TYPES }) @IsOptional() @IsIn(OWNER_TYPES as unknown as string[]) ownerType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() capacityDesc?: string;
  @ApiPropertyOptional({ example: 200 }) @IsOptional() @IsNumber() capacityQty?: number;
  @ApiPropertyOptional({ example: 'người / m2 / tấn' }) @IsOptional() @IsString() capacityUnit?: string;

  @ApiPropertyOptional({ enum: MOBILIZATION_TIMES }) @IsOptional() @IsIn(MOBILIZATION_TIMES as unknown as string[]) mobilizationTime?: string;
  @ApiPropertyOptional({ enum: RELIABILITIES }) @IsOptional() @IsIn(RELIABILITIES as unknown as string[]) reliability?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() agreementNo?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() agreementValidUntil?: string;
  @ApiPropertyOptional({ enum: AGREEMENT_STATUSES }) @IsOptional() @IsIn(AGREEMENT_STATUSES as unknown as string[]) agreementStatus?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() surveyedAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() surveyNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'GeoJSON Point', example: { type: 'Point', coordinates: [105.78, 19.8] } })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };
}

export class UpdateLocalResourceDto extends PartialType(CreateLocalResourceDto) {}

export class DeactivateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
