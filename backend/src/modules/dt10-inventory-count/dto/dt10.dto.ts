import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';
import { CountType, KK_FORM_CODES } from '../dt10.enums';

export class CreateCampaignDto {
  @ApiProperty() @IsString() campaignCode!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional({ enum: CountType }) @IsOptional() @IsEnum(CountType) countType?: CountType;
  @ApiPropertyOptional({ description: 'Phạm vi đa chiều (org/area/location/nganh)' })
  @IsOptional() @IsObject() scopeJson?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CutoffDto {
  @ApiPropertyOptional({ description: 'Mốc cutoff ISO-8601; bỏ trống = hiện tại' })
  @IsOptional() @IsString() cutoffTime?: string;
}

export class CampaignQuery extends PaginationQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

export class CreateSheetDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignee?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

// Một dòng kiểm đếm (blind — không có book_qty).
export class CountLineInput {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiProperty() @IsNumber() physicalQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class UpdateSheetLinesDto {
  @ApiProperty({ type: [CountLineInput] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => CountLineInput)
  lines!: CountLineInput[];
}

export class RecountDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class QualityGradesDto {
  @ApiProperty() @IsNumber() grade1!: number;
  @ApiProperty() @IsNumber() grade2!: number;
  @ApiProperty() @IsNumber() grade3!: number;
  @ApiProperty() @IsNumber() grade4!: number;
  @ApiProperty() @IsNumber() grade5!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class ResolveVarianceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CreateAdjustmentDto {
  @ApiProperty({ description: 'Chênh lệch nguồn để dựng điều chỉnh' }) @IsUUID() varianceId!: string;
  @ApiPropertyOptional({ description: 'Mã lý do (mặc định INVENTORY_COUNT)' })
  @IsOptional() @IsString() reasonCode?: string;
}

export class UnlockDto {
  @ApiProperty() @IsString() reason!: string;
}

export class ReviseDto {
  @ApiProperty() @IsString() reason!: string;
}

export class BuildDatasetDto {
  @ApiProperty({ enum: KK_FORM_CODES }) @IsIn(KK_FORM_CODES as unknown as string[]) formCode!: string;
}
