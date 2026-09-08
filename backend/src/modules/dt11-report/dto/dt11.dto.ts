import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { DATASET_SOURCE_TYPES, REPORT_FILE_FORMATS, SubmissionStatus } from '../dt11.enums';

// ---- report_definition / template_version ----
export class CreateReportDefinitionDto {
  @ApiProperty() @IsString() formCode!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class CreateTemplateVersionDto {
  @ApiProperty({ description: '{ datasetDefinitionCode?, columns:[{key,header}], unitLabel? }' })
  @IsObject()
  layoutSchemaJson!: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
  @ApiPropertyOptional({ description: 'Phát hành ngay (PUBLISHED) thay vì DRAFT' })
  @IsOptional()
  publish?: boolean;
}

// ---- dataset_definition + field/filter/formula ----
export class CreateDatasetDefinitionDto {
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty({ enum: DATASET_SOURCE_TYPES }) @IsIn(DATASET_SOURCE_TYPES) sourceType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unitId?: string;
}

export class AddFieldDto {
  @ApiProperty() @IsString() fieldKey!: string;
  @ApiProperty() @IsString() sourcePath!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() header?: string;
  @ApiPropertyOptional({ description: 'number | value | quality_total | string' })
  @IsOptional()
  @IsString()
  dataType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) orderNo?: number;
}

export class AddFilterDto {
  @ApiProperty() @IsString() filterKey!: string;
  @ApiProperty() @IsString() expr!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) orderNo?: number;
}

export class AddFormulaDto {
  @ApiProperty() @IsString() targetField!: string;
  @ApiProperty() @IsString() formulaExpr!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) orderNo?: number;
}

// ---- dataset_instance ----
export class GenerateDatasetDto {
  @ApiProperty({ description: 'code của dataset_definition' }) @IsString() datasetDefinitionCode!: string;
  @ApiProperty({ description: 'Tham chiếu snapshot nguồn, vd { campaignId } cho DT-10' })
  @IsObject()
  sourceRef!: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() scopeJson?: Record<string, unknown>;
}

// ---- report_instance ----
export class CreateReportInstanceDto {
  @ApiProperty({ description: 'form_code của biểu' }) @IsString() formCode!: string;
  @ApiProperty() @IsString() datasetInstanceId!: string;
  @ApiPropertyOptional({ description: 'template_version_id (bỏ trống → dùng bản PUBLISHED hiện hành)' })
  @IsOptional()
  @IsString()
  templateVersionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() scopeJson?: Record<string, unknown>;
}

export class IssueReportDto {
  @ApiPropertyOptional({ enum: REPORT_FILE_FORMATS, default: 'pdf' })
  @IsOptional()
  @IsIn(REPORT_FILE_FORMATS)
  format?: string;
}

// ---- rollup ----
export class RollupChildDto {
  @ApiProperty() @IsString() childOrgId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() childOrgName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() childInstanceId?: string;
  @ApiProperty({ enum: SubmissionStatus }) @IsIn(Object.values(SubmissionStatus)) submissionStatus!: SubmissionStatus;
}
export class RollupDto {
  @ApiProperty({ type: [RollupChildDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RollupChildDto)
  children!: RollupChildDto[];
}
