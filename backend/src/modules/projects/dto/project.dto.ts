import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export const PROJECT_TYPES = ['NEW_BUILD', 'RENOVATION', 'REPAIR', 'UPGRADE', 'INFRASTRUCTURE'] as const;
export const FUNDING_SOURCES = ['DEFENSE_BUDGET', 'STATE_BUDGET', 'LOCAL', 'OTHER'] as const;
// Vòng đời dự án theo thứ tự; chỉ tiến về sau + CANCELLED.
export const PROJECT_PHASES = [
  'PROPOSAL', 'DESIGN', 'BIDDING', 'CONTRACTED', 'IN_PROGRESS', 'ACCEPTANCE', 'HANDED_OVER', 'WARRANTY', 'CLOSED',
] as const;
export const MILESTONE_KINDS = ['PLAN', 'PROGRESS', 'ACCEPTANCE', 'PAYMENT', 'ISSUE'] as const;

export class CreateProjectDto {
  @ApiProperty({ example: 'DA-2026-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Cải tạo nhà làm việc Bộ CHQS tỉnh' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ enum: PROJECT_TYPES })
  @IsIn(PROJECT_TYPES as unknown as string[])
  projectType!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() barracksId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional({ enum: FUNDING_SOURCES }) @IsOptional() @IsIn(FUNDING_SOURCES as unknown as string[]) fundingSource?: string;

  @ApiPropertyOptional({ example: 5000000000 }) @IsOptional() @IsNumber() totalEstimate?: number;
  @ApiPropertyOptional({ example: 4800000000 }) @IsOptional() @IsNumber() approvedCapital?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() contractorName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contractNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() contractValue?: number;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() contractSignedDate?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() plannedEndDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() actualEndDate?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 100 }) @IsOptional() @IsInt() @Min(0) @Max(100) progressPercent?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({ description: 'GeoJSON Point', example: { type: 'Point', coordinates: [105.78, 19.8] } })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}

export class SetPhaseDto {
  @ApiProperty({ enum: [...PROJECT_PHASES, 'CANCELLED'] })
  @IsIn([...PROJECT_PHASES, 'CANCELLED'])
  phase!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Nghiệm thu giai đoạn 1' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ example: '2026-07-01', description: 'YYYY-MM-DD' })
  @IsString()
  milestoneDate!: string;

  @ApiPropertyOptional({ enum: MILESTONE_KINDS }) @IsOptional() @IsIn(MILESTONE_KINDS as unknown as string[]) kind?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @IsOptional() @IsInt() @Min(0) @Max(100) progressPercent?: number;
  @ApiPropertyOptional({ description: 'VND (dùng cho kind=PAYMENT)' }) @IsOptional() @IsNumber() amount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
