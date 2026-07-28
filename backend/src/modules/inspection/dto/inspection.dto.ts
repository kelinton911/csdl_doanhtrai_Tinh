import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCampaignDto {
  @ApiProperty({ example: 'KK-2026-Q1' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Kiểm kê quý I/2026' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  scope?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  plannedTo?: string;
}

export class LineInputDto {
  @ApiProperty({ enum: ['MATERIAL', 'FACILITY'] })
  @IsIn(['MATERIAL', 'FACILITY'])
  itemType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemRef?: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  expectedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  countedQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateSheetDto {
  @ApiProperty()
  @IsUUID()
  campaignId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  barracksId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateSheetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ type: [LineInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineInputDto)
  lines?: LineInputDto[];
}

export class ReviewDecisionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
