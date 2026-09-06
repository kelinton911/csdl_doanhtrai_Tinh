import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import {
  CatalogLinkType,
  ModelRelationshipType,
  RevisionStatus,
  TechDocumentType,
} from './tech.enums';

export class CreateModelDto {
  @ApiProperty() @IsString() modelCodeInternal!: string;
  @ApiProperty() @IsString() modelName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designSymbol?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() designYear?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuingAuthority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() technologyGroup?: string;
}

export class CreateCatalogLinkDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiPropertyOptional({ enum: CatalogLinkType }) @IsOptional() @IsEnum(CatalogLinkType) linkType?: CatalogLinkType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() basisDocumentId?: string;
}

export class CreateRevisionDto {
  @ApiProperty() @IsString() revisionCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() changeSummary?: string;
}

export class TransitionRevisionDto {
  @ApiProperty({ enum: RevisionStatus }) @IsEnum(RevisionStatus) to!: RevisionStatus;
}

export class CreateDocumentDto {
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional({ enum: TechDocumentType }) @IsOptional() @IsEnum(TechDocumentType) documentType?: TechDocumentType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() fileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileHash?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issueDate?: string;
}

export class CreateSheetDto {
  @ApiProperty() @IsString() sheetNo!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sheetTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sheetType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scaleText?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sourcePage?: number;
}

export class CreateAttributeDto {
  @ApiProperty() @IsString() attrName!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() valueNumeric?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() rawValue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() rawUnit?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sourceSheetId?: string;
}

export class CreateBomDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CreateBomItemDto {
  @ApiProperty() @IsString() rawName!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() lineNo?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() groupName?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() componentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() quantity?: number;
}

export class VerifyDto {
  @ApiPropertyOptional() @IsOptional() @IsString() sourceFile?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sourcePage?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() extractionMethod?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() confidenceLevel?: number;
}

export class CreateRelationshipDto {
  @ApiProperty() @IsUUID() sourceModelId!: string;
  @ApiProperty() @IsUUID() targetModelId!: string;
  @ApiProperty({ enum: ModelRelationshipType }) @IsEnum(ModelRelationshipType) relationshipType!: ModelRelationshipType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() basisDocumentId?: string;
}
