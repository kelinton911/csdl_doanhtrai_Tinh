import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';
import { ExecutionStatus, ReadinessLevel, VerificationStatus } from '../dt09.enums';

// ---------------- Nguồn địa bàn ----------------
export class CreateSourceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() sourceCode?: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ description: 'Xã/điểm (DT-02)' }) @IsUUID() adminUnitId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() areaId?: string;
  @ApiProperty({ description: 'SUPPLIER|WAREHOUSE|FARM|FACTORY|MARKET|OTHER' }) @IsString() sourceType!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() localResourceId?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateSourceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class SourceQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() adminUnitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

export class AddSourceMaterialDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsNumber() @Min(0) declaredQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() price?: number;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD hoặc ISO' }) @IsOptional() @IsString() asOfTime?: string;
}

// ---------------- Xác minh & huy động ----------------
export class EvidenceDto {
  @ApiProperty() @IsUUID() fileId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class VerifyDto {
  @ApiProperty({ enum: VerificationStatus }) @IsEnum(VerificationStatus) status!: VerificationStatus;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) verifiedQty?: number;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD hoặc ISO' }) @IsOptional() @IsString() expiresAt?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() evidenceFileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional({ type: [EvidenceDto] }) @IsOptional() @IsArray() @Type(() => EvidenceDto) evidence?: EvidenceDto[];
}

export class AssessMobilizationDto {
  @ApiProperty() @IsNumber() @Min(0) mobilizableQty!: number;
  @ApiProperty() @IsInt() @Min(0) leadTimeDays!: number;
  @ApiPropertyOptional({ enum: ReadinessLevel }) @IsOptional() @IsEnum(ReadinessLevel) readinessLevel?: ReadinessLevel;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

// ---------------- Kế hoạch cân đối ----------------
export class CreatePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() planCode?: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ description: 'Lần chạy DT-08 (calculation_run) cấp supply_required' }) @IsUUID() scenarioRunId!: string;
  @ApiPropertyOptional({ description: 'Deadline (số ngày) — lead_time ≤ deadline mới ELIGIBLE' })
  @IsOptional() @IsInt() @Min(0) deadlineDays?: number;
  @ApiPropertyOptional() @IsOptional() scope?: Record<string, unknown>;
}

export class ReservationDto {
  @ApiProperty() @IsUUID() sourceMaterialId!: string;
  @ApiProperty() @IsNumber() @Min(0) reservedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() priority?: number;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD hoặc ISO' }) @IsOptional() @IsString() expiresAt?: string;
  @ApiPropertyOptional({ description: 'row_version kỳ vọng của source_material (optimistic lock)' })
  @IsOptional() @IsInt() expectedSourceVersion?: number;
}

export class ExecutionRequestDto {
  @ApiProperty() @IsNumber() @Min(0) requestedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() targetOrg?: string;
  @ApiPropertyOptional({ description: 'Sinh chứng từ DT-05 ngay' }) @IsOptional() @IsBoolean() spawnDocument?: boolean;
  @ApiPropertyOptional({ description: 'Đơn vị lập chứng từ DT-05' }) @IsOptional() @IsUUID() organizationId?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() effectiveDate?: string;
}

export class ExecutionFeedbackDto {
  @ApiProperty() @IsNumber() @Min(0) deliveredQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() feedbackNote?: string;
  @ApiPropertyOptional({ enum: ExecutionStatus }) @IsOptional() @IsEnum(ExecutionStatus) status?: ExecutionStatus;
}
