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

// Mã phân loại kho theo điều lệ ký hiệu quân sự (09-2011, Mục S — xem REF-2026-003).
// Ngành = chữ TRONG ký hiệu; Cấp = HÌNH NỀN ký hiệu.
export const STORAGE_NGANH_CODES: string[] = ['LT', 'XD', 'QN', 'QY', 'VT', 'DAN', 'TH', 'KT'];
export const STORAGE_CAP_CODES: string[] = [
  'TINH',
  'HUYEN',
  'XA',
  'DOANH_TRAI',
  'QK',
  'QD',
  'F',
  'E',
  'D',
  'C',
];

export class InventoryFilterQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storageLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiPropertyOptional({ description: 'Lọc tồn theo 1 xã/phường (địa bàn kho)' })
  @IsOptional()
  @IsUUID()
  areaId?: string;
}

// Tổng hợp vật chất tồn theo xã ("Vật chất chung của xã"): bỏ trống areaId = tổng toàn tỉnh.
export class InventorySummaryQuery {
  @ApiPropertyOptional({ description: 'Lọc theo 1 xã/phường; bỏ trống = tổng toàn tỉnh' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ description: 'Lọc theo mã nhóm ngành vật chất (category_code)' })
  @IsOptional()
  @IsString()
  categoryCode?: string;
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

  @ApiPropertyOptional({
    enum: STORAGE_NGANH_CODES,
    description: 'Ngành hậu cần (chữ trong ký hiệu QS): LT/XD/QN/QY/VT/DAN/TH/KT',
  })
  @IsOptional()
  @IsIn(STORAGE_NGANH_CODES)
  nganh?: string;

  @ApiPropertyOptional({
    enum: STORAGE_CAP_CODES,
    description: 'Cấp quản lý kho (hình nền ký hiệu QS): TINH/HUYEN/XA/DOANH_TRAI/QK/QD/F/E/D/C',
  })
  @IsOptional()
  @IsIn(STORAGE_CAP_CODES)
  cap?: string;

  @ApiPropertyOptional({ description: 'Khối lượng (tấn) ghi trong ký hiệu', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityTons?: number;

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
