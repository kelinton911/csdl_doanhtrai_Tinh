import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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
