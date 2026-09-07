import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { NormSourceStatus, NormValueType } from './norms-rules';

// ---- Văn bản căn cứ ----
export class CreateNormativeDocumentDto {
  @ApiProperty() @IsString() docNo!: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() issuingAuthority!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issueDate?: string;
}

export class CreateDocumentVersionDto {
  @ApiProperty() @IsString() versionLabel!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileHash?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
}

export class CreateSourceReferenceDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() pageNo?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() lineRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() quoteText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() appendixCode?: string;
}

// ---- Bộ định mức + phiên bản ----
export class CreateNormSetDto {
  @ApiProperty() @IsString() setCode!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class CreateNormSetVersionDto {
  @ApiProperty() @IsString() versionLabel!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentVersionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
}

// ---- Định mức vật chất ----
export class CreateMaterialNormDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsString() semanticParam!: string;
  @ApiPropertyOptional({ enum: NormValueType }) @IsOptional() @IsEnum(NormValueType) valueType?: NormValueType;
  @ApiPropertyOptional() @IsOptional() @IsNumber() valueNumeric?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() rawValue?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() formulaExpr?: string;
  // Trích dẫn căn cứ — có → VERIFIED (dùng chính thức); không → LEGACY_UNVERIFIED (BR-DT07-026).
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceReferenceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
}

export class NormScopeDto {
  @ApiProperty() @IsString() dimensionType!: string;
  @ApiProperty() @IsString() dimensionValue!: string;
}

export class AddScopesDto {
  @ApiProperty({ type: [NormScopeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NormScopeDto)
  dimensions!: NormScopeDto[];
}

// ---- Resolve (DT-08 gọi) ----
export class ResolveScopeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() org?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() territory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mission?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phase?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() quality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() time?: string;
}

export class ResolveNormDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsString() semanticParam!: string;
  @ApiPropertyOptional({ type: ResolveScopeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResolveScopeDto)
  scope?: ResolveScopeDto;
  @ApiPropertyOptional() @IsOptional() @IsString() asOfTime?: string;
}

export class ResolveConflictDto {
  @ApiProperty() @IsUUID() resolvedNormId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolutionNote?: string;
}

// ---- Tham số tính toán + xếp hạng cơ quan ----
export class CreateCalculationParameterDto {
  @ApiProperty() @IsString() semanticParam!: string;
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
}

export class CreateAuthorityRankDto {
  @ApiProperty() @IsString() versionLabel!: string;
  @ApiProperty() @IsObject() rankJson!: Record<string, number>;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ---- Nhập Excel định mức (→ DRAFT) ----
export class ImportNormsDto {
  @ApiProperty() @IsString() fileName!: string;
  @ApiProperty() @IsString() fileHash!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() normSetVersionId?: string;
  @ApiProperty({ type: [Object] }) @IsArray() rows!: Array<Record<string, unknown>>;
}

// ---- Chỉ lệnh hậu cần ----
export class CreateCommandDto {
  @ApiPropertyOptional() @IsOptional() @IsString() commandNo?: string;
  @ApiProperty() @IsString() title!: string;
  @ApiProperty() @IsString() issuingAuthority!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveDate?: string;
}

export class CreateCommandVersionDto {
  @ApiProperty() @IsString() versionLabel!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CreateRequirementDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsNumber() requiredQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() deadline?: string;
}

export class CreateAssignmentDto {
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiProperty() @IsNumber() allocatedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() deadline?: string;
}

export class CreateProgressDto {
  @ApiProperty() @IsNumber() reportedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
