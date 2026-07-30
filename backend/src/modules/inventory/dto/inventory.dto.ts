import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQuery, SearchQuery } from '../../../common/dto/pagination.dto';

export class InventoryFilterQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storageLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  materialId?: string;
}

// Lọc danh sách kho (kèm tìm kiếm mã/tên + trạng thái workflow).
export class ListStorageLocationsQuery extends SearchQuery {
  @ApiPropertyOptional({ description: 'Lọc theo trạng thái workflow (vd PENDING_REVIEW)' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateStorageLocationDto {
  @ApiProperty({ example: 'KHO-A01' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Kho hậu cần A01' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  barracksId?: string;

  @ApiPropertyOptional({ description: 'UUID xã/phường (địa bàn kho)' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị quản lý' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

// Cập nhật kho: chỉ trường cho phép; mã kho cố định sau khi tạo.
export class UpdateStorageLocationDto extends PartialType(CreateStorageLocationDto) {}

export class StorageReviewDto {
  @ApiPropertyOptional({ example: 'Thiếu toạ độ/loại kho.' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateTransactionDto {
  @ApiProperty()
  @IsUUID()
  materialId!: string;

  @ApiProperty()
  @IsUUID()
  storageLocationId!: string;

  @ApiProperty({ enum: ['IN', 'OUT'], description: 'Nhập hoặc xuất' })
  @IsIn(['IN', 'OUT'])
  type!: 'IN' | 'OUT';

  @ApiProperty({ example: 100, minimum: 0 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Cho phép tồn âm (quyền ngoại lệ)' })
  @IsOptional()
  @IsBoolean()
  allowNegative?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class AdjustmentDto {
  @ApiProperty()
  @IsUUID()
  materialId!: string;

  @ApiProperty()
  @IsUUID()
  storageLocationId!: string;

  @ApiProperty({ example: 95, minimum: 0, description: 'Số kiểm kê thực tế' })
  @IsNumber()
  @Min(0)
  countedQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
