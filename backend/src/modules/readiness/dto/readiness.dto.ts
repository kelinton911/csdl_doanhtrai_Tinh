import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';

export const SITE_TYPES = ['EVACUATION', 'DISPERSAL', 'RESERVE', 'DEPLOYMENT', 'FIELD_MEDICAL', 'COMMAND_POST'] as const;
export const CONCEALMENTS = ['GOOD', 'FAIR', 'POOR'] as const;
export const READINESS_LEVELS = ['READY', 'PARTIAL', 'NOT_READY'] as const;
export const SITE_ROLES = ['PRIMARY', 'BACKUP', 'ALTERNATE'] as const;
export const DEFENSE_STATES = ['NORMAL', 'SSCD', 'EVACUATION', 'COMBAT', 'RECOVERY'] as const;
export const SEVERITIES = ['LIGHT', 'MODERATE', 'HEAVY', 'DESTROYED'] as const;
export const RECOVERY_STATUSES = ['ASSESSING', 'COORDINATING', 'IN_PROGRESS', 'RECOVERED'] as const;

export class CreateSiteDto {
  @ApiProperty({ example: 'ST-001' }) @IsString() @MinLength(3) code!: string;
  @ApiProperty({ example: 'Khu sơ tán rừng Bến En' }) @IsString() @MinLength(3) name!: string;
  @ApiPropertyOptional({ enum: SITE_TYPES }) @IsOptional() @IsIn(SITE_TYPES as unknown as string[]) siteType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional({ example: 300 }) @IsOptional() @IsInt() @Min(0) capacity?: number;
  @ApiPropertyOptional({ enum: CONCEALMENTS }) @IsOptional() @IsIn(CONCEALMENTS as unknown as string[]) concealment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() accessRoad?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasPower?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasWater?: boolean;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(0) tentCapability?: number;
  @ApiPropertyOptional({ example: 6 }) @IsOptional() @IsNumber() deployTimeHours?: number;
  @ApiPropertyOptional({ enum: READINESS_LEVELS }) @IsOptional() @IsIn(READINESS_LEVELS as unknown as string[]) readiness?: string;
  @ApiPropertyOptional({ enum: SITE_ROLES }) @IsOptional() @IsIn(SITE_ROLES as unknown as string[]) role?: string;
  @ApiPropertyOptional({ enum: DEFENSE_STATES }) @IsOptional() @IsIn(DEFENSE_STATES as unknown as string[]) defenseState?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ description: 'GeoJSON Point' }) @IsOptional() @IsObject() location?: { type: 'Point'; coordinates: [number, number] };
}
export class UpdateSiteDto extends PartialType(CreateSiteDto) {}
export class DeactivateDto { @ApiPropertyOptional() @IsOptional() @IsString() reason?: string; }

export class CreateRecoveryDto {
  @ApiProperty({ example: 'KP-001' }) @IsString() @MinLength(3) code!: string;
  @ApiProperty({ example: 'Khắc phục nhà kho hư hỏng do bão' }) @IsString() @MinLength(3) title!: string;
  @ApiPropertyOptional({ enum: SEVERITIES }) @IsOptional() @IsIn(SEVERITIES as unknown as string[]) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dangerZone?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() damageEventId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() barracksId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() neededMaterials?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() neededForces?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() estimatedLoss?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() scenario?: boolean;
  @ApiPropertyOptional({ description: 'GeoJSON Point' }) @IsOptional() @IsObject() location?: { type: 'Point'; coordinates: [number, number] };
}
export class UpdateRecoveryDto extends PartialType(CreateRecoveryDto) {}
export class SetRecoveryStatusDto {
  @ApiProperty({ enum: RECOVERY_STATUSES }) @IsIn(RECOVERY_STATUSES as unknown as string[]) status!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
