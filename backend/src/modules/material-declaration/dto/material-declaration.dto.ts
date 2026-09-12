import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ReservePurpose } from '../material-declaration.enums';

export class CreateDeclarationDto {
  @ApiPropertyOptional({ description: 'Mã bản khai báo; bỏ trống sẽ tự sinh' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ example: 'Khai báo vật chất Quý I/2026' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị/xã sở hữu; mặc định = đơn vị người dùng' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'UUID xã/phường (địa bàn)' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ description: 'UUID kho/địa điểm (M06)' })
  @IsOptional()
  @IsUUID()
  storageLocationId?: string;

  @ApiPropertyOptional({ description: 'UUID doanh trại gắn bản khai báo' })
  @IsOptional()
  @IsUUID()
  barracksId?: string;

  @ApiPropertyOptional({ example: 'Quý I/2026' })
  @IsOptional()
  @IsString()
  periodLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateDeclarationDto extends PartialType(CreateDeclarationDto) {}

// ---- Biểu mẫu định mức (bộ mã vật chất chuẩn) ----
export class TemplateItemDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsString() label!: string;
}
export class CreateTemplateDto {
  @ApiProperty({ example: 'Định mức doanh cụ đại đội' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [TemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateItemDto)
  items!: TemplateItemDto[];
}

export class CreateLineDto {
  @ApiProperty({ description: 'UUID mã vật chất chuẩn (material_catalog.id)' })
  @IsUUID()
  materialCatalogId!: string;

  @ApiPropertyOptional({ description: 'Tên gọi khác đã dùng khi tra mã' })
  @IsOptional()
  @IsString()
  aliasUsed?: string;

  @ApiPropertyOptional({ description: 'UUID ĐVT (unit_of_measure)' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: ReservePurpose, default: ReservePurpose.THUONG_XUYEN })
  @IsOptional()
  @IsEnum(ReservePurpose)
  reservePurpose?: ReservePurpose;

  @ApiPropertyOptional({ example: 100, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyGrade1?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyGrade2?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyGrade3?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyGrade4?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  qtyGrade5?: number;

  // --- Biến động kỳ (02/KK): cuối kỳ = đầu kỳ + tăng − giảm ---
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingQty?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  increaseQty?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  decreaseQty?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Bỏ trống → tự tính = đầu kỳ + tăng − giảm' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  closingQty?: number;

  // --- Tách vị trí tồn (02/KK): cuối kỳ = đang dùng + kho Bộ-Ngành + kho đơn vị ---
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  inUseQty?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ministryStoreQty?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitStoreQty?: number;

  // --- Giá trị (1000đ) + quy trọng lượng ---
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  openingValue?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  increaseValue?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  decreaseValue?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  closingValue?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  convertedWeight?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateLineDto extends PartialType(CreateLineDto) {}

// Dòng trong lô bulk: có `id` = cập nhật, không có = thêm mới.
export class UpsertLineDto extends CreateLineDto {
  @ApiPropertyOptional({ description: 'UUID dòng đã có (bỏ trống = thêm mới)' })
  @IsOptional()
  @IsUUID()
  id?: string;
}

// Lưu hàng loạt dòng vật chất trong 1 giao dịch (nhập dạng bảng / dán Excel).
export class BulkLinesDto {
  @ApiProperty({ type: [UpsertLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertLineDto)
  lines!: UpsertLineDto[];

  @ApiPropertyOptional({ description: 'Danh sách UUID dòng cần xóa', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  deleteIds?: string[];
}

// Kế thừa dòng từ một bản khai báo kỳ trước (đầu kỳ = cuối kỳ nguồn).
export class CarryForwardDto {
  @ApiProperty({ description: 'UUID bản khai báo nguồn (nên đã DUYỆT)' })
  @IsUUID()
  sourceDeclarationId!: string;
}

// Nhân bản bản khai báo (tạo bản DRAFT mới + copy toàn bộ dòng).
export class DuplicateDeclarationDto {
  @ApiProperty({ example: 'Khai báo vật chất Quý II/2026' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ example: 'Quý II/2026' })
  @IsOptional()
  @IsString()
  periodLabel?: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị/xã đích (mặc định = đơn vị nguồn)' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class CreateAmendmentDto {
  @ApiProperty({ example: 'Sửa số lượng dòng gạo từ 100 → 120' })
  @IsString()
  @MinLength(3)
  requestedChanges!: string;

  @ApiProperty({ example: 'Sai lệch do kiểm kê lại kho' })
  @IsString()
  @MinLength(3)
  reason!: string;

  @ApiPropertyOptional({ description: 'Mảng documents.id (minh chứng)', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  evidenceDocumentIds?: string[];
}

export class ReviewDecisionDto {
  @ApiPropertyOptional({ example: 'Không đủ minh chứng.' })
  @IsOptional()
  @IsString()
  note?: string;
}
