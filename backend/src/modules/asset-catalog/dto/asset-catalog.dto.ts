import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';

export const ASSET_DOMAINS = ['FACILITY', 'MATERIAL', 'ROOT', 'UNCLASSIFIED'] as const;
export const ASSET_CODE_STATUSES = ['UNMAPPED', 'MAPPED', 'OUT_OF_SCOPE', 'PROPOSED'] as const;

/**
 * Phân trang riêng cho danh mục tài sản: `PaginationQuery` dùng chung chặn size ở 200,
 * nhưng cây con của một chương có thể tới ~200+ nút và bản xuất cần lấy cả 1272 dòng.
 * KHÔNG nới ngưỡng của DTO dùng chung — sẽ nới lỏng cho mọi endpoint khác trong hệ thống.
 */
export class AssetCatalogQuery extends PaginationQuery {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  size = 20;
}

export class AssetTreeQuery {
  @ApiPropertyOptional({ description: 'Mã nút cha; bỏ trống để lấy nút gốc' })
  @IsOptional()
  @IsString()
  parent?: string;

  @ApiPropertyOptional({ enum: ASSET_DOMAINS })
  @IsOptional()
  @IsIn(ASSET_DOMAINS as unknown as string[])
  domain?: string;

  @ApiPropertyOptional({ description: 'true = chỉ lấy nút lá' })
  @IsOptional()
  @IsBooleanString()
  leafOnly?: string;
}

export class AssetSearchQuery extends AssetCatalogQuery {
  @ApiPropertyOptional({ description: 'Từ khoá: tìm theo tên (không dấu) hoặc mã' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ASSET_DOMAINS })
  @IsOptional()
  @IsIn(ASSET_DOMAINS as unknown as string[])
  domain?: string;

  @ApiPropertyOptional({ description: 'Số La Mã của chương, vd "VII"' })
  @IsOptional()
  @IsString()
  chapter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  leafOnly?: string;

  @ApiPropertyOptional({ description: 'true = chỉ nút bị cảnh báo trùng tên khác chương' })
  @IsOptional()
  @IsBooleanString()
  duplicatesOnly?: string;
}

export class AssetSubtreeQuery extends AssetCatalogQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  leafOnly?: string;
}

export class AssetGapsQuery extends AssetCatalogQuery {
  @ApiPropertyOptional({ enum: ['material', 'facility'], default: 'material' })
  @IsOptional()
  @IsIn(['material', 'facility'])
  kind?: 'material' | 'facility';

  @ApiPropertyOptional({ enum: ASSET_CODE_STATUSES, default: 'UNMAPPED' })
  @IsOptional()
  @IsIn(ASSET_CODE_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
