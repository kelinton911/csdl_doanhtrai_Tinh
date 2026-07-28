import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// Phân trang page/size cho danh mục nhỏ (Hồ sơ TKKT §7).
export class PaginationQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  size = 20;

  get skip(): number {
    return (this.page - 1) * this.size;
  }
}

// Bộ lọc tìm kiếm dùng chung: page/size + q (từ khóa). Mở rộng cho từng endpoint.
export class SearchQuery extends PaginationQuery {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm' })
  @IsOptional()
  @IsString()
  search?: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; size: number; total: number };
}

export function paginated<T>(
  data: T[],
  total: number,
  q: PaginationQuery,
): Paginated<T> {
  return { data, meta: { page: q.page, size: q.size, total } };
}
