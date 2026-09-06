import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { SearchQuery } from '../../../common/dto/pagination.dto';

// Lọc danh mục C3 theo phân hệ + từ khóa (tra cứu ma trận truy vết).
export class C3Query extends SearchQuery {
  @ApiPropertyOptional({ description: 'Phân hệ DT-01..DT-12 hoặc SYS' })
  @IsOptional()
  @IsString()
  subsystem?: string;
}
