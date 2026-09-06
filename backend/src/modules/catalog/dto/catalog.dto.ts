import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { SearchQuery } from '../../../common/dto/pagination.dto';
import {
  AliasType,
  ChangeRequestType,
  UnitType,
} from '../catalog.enums';

export class CreateVersionDto {
  @ApiProperty() @IsString() versionCode!: string;
  @ApiProperty() @IsString() versionName!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceDocumentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuedBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTo?: string;
}

export class CreateUnitDto {
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() symbol?: string;
  @ApiPropertyOptional({ enum: UnitType }) @IsOptional() @IsEnum(UnitType) unitType?: UnitType;
}

export class CreateItemDto {
  @ApiProperty() @IsUUID() versionId!: string;
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isLeaf?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
}

export class CreateAliasDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsString() aliasName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() aliasCode?: string;
  @ApiPropertyOptional({ enum: AliasType }) @IsOptional() @IsEnum(AliasType) aliasType?: AliasType;
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
}

export class UpdateAliasDto {
  @ApiPropertyOptional() @IsOptional() @IsString() aliasName?: string;
  @ApiPropertyOptional({ enum: AliasType }) @IsOptional() @IsEnum(AliasType) aliasType?: AliasType;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class CreateReplacementDto {
  @ApiProperty() @IsUUID() oldMaterialId!: string;
  @ApiProperty() @IsUUID() newMaterialId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CreateChangeRequestDto {
  @ApiProperty() @IsString() proposedName!: string;
  @ApiPropertyOptional({ enum: ChangeRequestType }) @IsOptional() @IsEnum(ChangeRequestType) requestType?: ChangeRequestType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() proposedUnitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() proposedParentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() technicalSpec?: Record<string, unknown>;
}

export class ReviewChangeRequestDto {
  @ApiProperty() @IsString() decision!: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class MapExistingDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
}

export class CreateTemporaryDto {
  @ApiProperty() @IsString() temporaryCode!: string;
  @ApiProperty() @IsString() displayName!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() proposedParentId?: string;
}

export class AssignOfficialCodeDto {
  @ApiProperty() @IsUUID() officialMaterialId!: string;
}

export class CreateImportBatchDto {
  @ApiProperty() @IsString() fileName!: string;
  @ApiProperty() @IsString() fileHash!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() versionCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceDocumentId?: string;
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  rows?: Array<{ rowNo?: number; code?: string; name?: string; parentCode?: string; unitCode?: string }>;
}

export class ItemQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() versionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
}

export class CompareQuery {
  @ApiProperty() @IsUUID() from!: string;
  @ApiProperty() @IsUUID() to!: string;
}

export class VersionQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class PageQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) _placeholder?: number;
}
