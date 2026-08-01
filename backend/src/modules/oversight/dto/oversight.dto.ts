import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const INSPECTION_TYPES = ['PERIODIC', 'SURPRISE', 'THEMATIC', 'AUDIT', 'SUPERIOR'] as const;
export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export class CreateInspectionDto {
  @ApiProperty({ example: 'KT-2026-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Kiểm tra công tác doanh trại xã A' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ enum: INSPECTION_TYPES }) @IsOptional() @IsIn(INSPECTION_TYPES as unknown as string[]) inspectionType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scope?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetOrgId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetAreaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetBarracksId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() leadName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() teamNote?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() plannedDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() endDate?: string;
}

export class UpdateInspectionDto extends PartialType(CreateInspectionDto) {
  @ApiPropertyOptional() @IsOptional() @IsString() conclusion?: string;
}

export class SetInspectionStatusDto {
  @ApiProperty({ enum: ['IN_PROGRESS', 'REPORTED', 'CLOSED', 'CANCELLED'] })
  @IsIn(['IN_PROGRESS', 'REPORTED', 'CLOSED', 'CANCELLED'])
  status!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() conclusion?: string;
}

export class CreateFindingDto {
  @ApiProperty({ example: 'Hồ sơ đất chưa đầy đủ pháp lý' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ enum: SEVERITIES }) @IsOptional() @IsIn(SEVERITIES as unknown as string[]) severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recommendation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleOrgId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() responsibleAreaId?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkedEntityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkedEntityId?: string;
}

export class UpdateFindingDto extends PartialType(CreateFindingDto) {}

export class ResolveFindingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionNote?: string;
}
