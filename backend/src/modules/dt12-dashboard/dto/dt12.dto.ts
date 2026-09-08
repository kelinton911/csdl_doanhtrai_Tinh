import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { FACT_TYPES, SEMANTICS, ThresholdDirection } from '../dt12.enums';

const DIRECTIONS = Object.values(ThresholdDirection);

// ---- kpi_definition / formula_version / threshold ----
export class CreateKpiDefinitionDto {
  @ApiProperty() @IsString() kpiCode!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: SEMANTICS }) @IsIn(SEMANTICS) semanticRef!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class CreateFormulaVersionDto {
  @ApiPropertyOptional({ description: 'Mặc định SUM(semantic)' }) @IsOptional() @IsString() formulaExpr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
  @ApiPropertyOptional({ description: 'Kích hoạt ngay (ACTIVE) thay vì DRAFT' }) @IsOptional() activate?: boolean;
}

export class CreateThresholdDto {
  @ApiPropertyOptional() @IsOptional() @IsObject() scopeJson?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsNumber() warnLevel?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() criticalLevel?: number;
  @ApiProperty({ enum: DIRECTIONS }) @IsIn(DIRECTIONS) direction!: string;
}

// ---- metric ----
export class ComputeMetricDto {
  @ApiProperty({ description: 'kpi_code của KPI cần tính' }) @IsString() kpiCode!: string;
  @ApiPropertyOptional({ description: 'Phạm vi { organizationId?, areaIds? }' }) @IsOptional() @IsObject() scopeJson?: Record<string, unknown>;
  @ApiPropertyOptional({ description: 'as_of_time ISO-8601 (bỏ trống = hiện tại)' }) @IsOptional() @IsString() asOf?: string;
}

// ---- data mart ----
export class DataMartRefreshDto {
  @ApiProperty({ enum: FACT_TYPES, description: 'Loại fact cần refresh' }) @IsIn(FACT_TYPES) factType!: string;
  @ApiPropertyOptional({ description: 'Tham chiếu nguồn (bỏ trống = snapshot mới nhất)' }) @IsOptional() @IsObject() sourceRef?: Record<string, unknown>;
}

// ---- alert_rule ----
export class CreateAlertRuleDto {
  @ApiProperty() @IsString() ruleCode!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ description: 'kpi_code' }) @IsString() kpiCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() scopeJson?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsNumber() warnLevel?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() criticalLevel?: number;
  @ApiProperty({ enum: DIRECTIONS }) @IsIn(DIRECTIONS) direction!: string;
  @ApiPropertyOptional({ default: 72 }) @IsOptional() @IsInt() @Min(0) slaHours?: number;
}

export class EvaluateAlertsDto {
  @ApiPropertyOptional({ description: 'Giới hạn 1 rule_code (bỏ trống = quét mọi rule ACTIVE)' }) @IsOptional() @IsString() ruleCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() asOf?: string;
}

export class AckAlertDto {
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
export class ResolveAlertDto {
  @ApiProperty() @IsString() resolution!: string;
}
export class AssignAlertDto {
  @ApiProperty() @IsString() assigneeId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

// ---- decision ----
export class CreateDecisionSessionDto {
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() scopeJson?: Record<string, unknown>;
  @ApiPropertyOptional({ description: 'Tham số what-if (cách ly)' }) @IsOptional() @IsObject() paramsJson?: Record<string, unknown>;
}

export class AddOptionDto {
  @ApiProperty() @IsString() optionKey!: string;
  @ApiProperty() @IsString() label!: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() paramsJson?: Record<string, unknown>;
}

export class AddCriterionDto {
  @ApiProperty() @IsString() criterionKey!: string;
  @ApiProperty() @IsString() label!: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsNumber() weight?: number;
  @ApiPropertyOptional({ enum: ['HIGHER_BETTER', 'LOWER_BETTER'], default: 'HIGHER_BETTER' })
  @IsOptional()
  @IsIn(['HIGHER_BETTER', 'LOWER_BETTER'])
  direction?: string;
}

export class ScoreCellDto {
  @ApiProperty() @IsString() optionKey!: string;
  @ApiProperty() @IsString() criterionKey!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rawValue?: number;
}
export class ScoreDto {
  @ApiProperty({ type: [ScoreCellDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScoreCellDto)
  scores!: ScoreCellDto[];
}

export class RecordDecisionDto {
  @ApiPropertyOptional({ description: 'option_key được chọn' }) @IsOptional() @IsString() chosenOptionKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rationale?: string;
}
