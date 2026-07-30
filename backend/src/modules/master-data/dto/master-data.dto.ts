import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';

export class ListMaterialsQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

// Các loại danh mục được hỗ trợ (UC-03). Dùng cho gợi ý và kiểm tra.
export const CATALOG_TYPES = [
  'unit-of-measure',
  'material-category',
  'facility-type',
  'quality-grade',
  'damage-cause',
  'storage-location-type',
  'organization-type',
] as const;

export class CreateCatalogDto {
  @ApiProperty({ example: 'CAI' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: 'Cái' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentCode?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCatalogDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateMaterialDto {
  @ApiProperty({ example: 'VC-GAO' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Gạo tẻ' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'LUONG-THUC' })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional({ example: 'KG' })
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spec?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualityGrade?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultScale?: number;

  // Mã trong danh mục chuẩn BQP (asset_catalog_items.code, miền MATERIAL).
  // Có mã này = vật chất được chọn từ danh mục gốc (assetCodeStatus='MAPPED').
  @ApiPropertyOptional({ example: 'R05.01.01.00.00.001' })
  @IsOptional()
  @IsString()
  assetCode?: string;

  // Đánh dấu vật chất ngành khác (không có trong phụ lục ngành Doanh trại) — cho nhập tay.
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  outOfScope?: boolean;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}

export class UpdateMaterialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  spec?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualityGrade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;
}
