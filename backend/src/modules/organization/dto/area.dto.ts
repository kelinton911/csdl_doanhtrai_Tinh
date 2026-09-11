import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';

export class CreateAreaDto {
  @ApiProperty({ example: 'XA-A01' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Xã A01' })
  @IsString()
  @MinLength(2)
  name!: string;

  // COMMUNE = Xã, WARD = Phường, SPECIAL_ZONE = Đặc khu (cấp xã sau sáp nhập 2025).
  @ApiProperty({ enum: ['COMMUNE', 'WARD', 'SPECIAL_ZONE'], default: 'COMMUNE' })
  @IsOptional()
  @IsIn(['COMMUNE', 'WARD', 'SPECIAL_ZONE'])
  type?: string;
}

// Bộ lọc danh sách địa bàn: dùng cho cascade Tỉnh → Xã ở form doanh trại.
// level=PROVINCE để lấy danh sách tỉnh; level=COMMUNE + provinceCode để lấy xã theo tỉnh.
export class ListAreaQuery extends PaginationQuery {
  @ApiPropertyOptional({ description: 'Từ khóa tìm theo mã hoặc tên' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['PROVINCE', 'COMMUNE'], description: 'Cấp hành chính' })
  @IsOptional()
  @IsIn(['PROVINCE', 'COMMUNE'])
  level?: string;

  @ApiPropertyOptional({ description: 'Lọc xã theo mã tỉnh (province_code)' })
  @IsOptional()
  @IsString()
  provinceCode?: string;
}
