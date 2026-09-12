import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

// Nguồn danh mục cho dòng vật chất KVPT.
export const CATALOG_GROUPS = ['STANDARD', 'LOCAL_POTENTIAL'] as const;

// Danh sách CHỈ SỐ định lượng (numeric) của tiềm lực HC-KT — dùng chung cho entity/DTO/FE.
export const POTENTIAL_METRIC_KEYS = [
  'population', 'households', 'laborForce', 'militiaSelfDefense', 'reserveForce',
  'foodReserveTons', 'annualFoodOutputTons', 'livestockHeads',
  'medicalStations', 'hospitalBeds', 'medicalStaff',
  'fuelStations', 'fuelReserveM3',
  'trucks', 'passengerCars', 'boats', 'transportCapacityTons',
  'civilWarehouses', 'schools', 'factories',
] as const;

export type PotentialMetricKey = (typeof POTENTIAL_METRIC_KEYS)[number];

// Bản khai tiềm lực HC-KT của khu vực cấp xã.
export class CreateCommunePotentialDto {
  @ApiPropertyOptional({ description: 'Mã bản khai (bỏ trống → tự sinh)' })
  @IsOptional() @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  areaId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  periodLabel?: string;

  // Chỉ số định lượng (đều tùy chọn, ≥ 0).
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) population?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) households?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) laborForce?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) militiaSelfDefense?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) reserveForce?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) foodReserveTons?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) annualFoodOutputTons?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) livestockHeads?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) medicalStations?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) hospitalBeds?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) medicalStaff?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fuelStations?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fuelReserveM3?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) trucks?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) passengerCars?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) boats?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) transportCapacityTons?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) civilWarehouses?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) schools?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) factories?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() assessment?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class UpdateCommunePotentialDto extends PartialType(CreateCommunePotentialDto) {}

export class ReviewDecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  reason?: string;
}

// Một dòng vật chất tiềm lực (KVPT) — chọn theo material_catalog.
export class UpsertPotentialMaterialDto {
  @ApiPropertyOptional({ description: 'Giữ id để cập nhật; bỏ trống → tạo mới' })
  @IsOptional() @IsUUID()
  id?: string;

  @ApiProperty({ description: 'material_catalog.id (mã chuẩn hoặc nhóm tiềm lực địa phương)' })
  @IsUUID()
  materialCatalogId!: string;

  @ApiPropertyOptional({ description: 'Tên gọi khác người nhập đã dùng' })
  @IsOptional() @IsString()
  aliasUsed?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: CATALOG_GROUPS, description: 'STANDARD | LOCAL_POTENTIAL' })
  @IsOptional() @IsIn(CATALOG_GROUPS)
  catalogGroup?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional() @IsNumber() @Min(0)
  quantity?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  note?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  sortOrder?: number;
}

// Ghi đè toàn bộ danh sách dòng vật chất của một bản khai (bulk upsert).
export class ReplacePotentialMaterialsDto {
  @ApiProperty({ type: [UpsertPotentialMaterialDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertPotentialMaterialDto)
  materials!: UpsertPotentialMaterialDto[];
}

// Lọc cuộn KVPT cấp Tỉnh.
export class KvptSummaryQuery {
  @ApiPropertyOptional({ description: 'Lọc theo 1 xã; bỏ trống = toàn tỉnh' })
  @IsOptional() @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ enum: CATALOG_GROUPS, description: 'Lọc theo nguồn danh mục' })
  @IsOptional() @IsIn(CATALOG_GROUPS)
  catalogGroup?: string;
}
