import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';
import { SSCD_ALLOCATION_STATES } from '../readiness-material.constants';

const STATES = SSCD_ALLOCATION_STATES as unknown as string[];

export class ListAllocationQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: SSCD_ALLOCATION_STATES, description: 'Lọc theo trạng thái SSCĐ' })
  @IsOptional() @IsIn(STATES)
  readinessState?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái workflow (vd PENDING_REVIEW)' })
  @IsOptional() @IsString()
  status?: string;
}

export class CreateAllocationPlanDto {
  @ApiProperty({ enum: SSCD_ALLOCATION_STATES, description: 'Trạng thái SSCĐ (Tăng cường/Cao/Toàn bộ)' })
  @IsIn(STATES)
  readinessState!: string;

  @ApiProperty({ description: 'Tên phương án' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ description: 'Căn cứ pháp lý / chỉ lệnh Quân khu' })
  @IsOptional() @IsString()
  regulationRef?: string;

  @ApiPropertyOptional({ description: 'Kỳ/năm hiệu lực (VD "2026")' })
  @IsOptional() @IsString()
  periodLabel?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;
}

export class UpdateAllocationPlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() regulationRef?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() periodLabel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

// Một dòng phân cấp lượng: vật chất × lượng theo 4 cấp (kho Tỉnh/xã/trung đoàn/căn cứ).
export class AllocationLineDto {
  @ApiProperty({ description: 'material_catalog.id' })
  @IsUUID()
  materialCatalogId!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsNumber() @Min(0) qtyKhoTinh?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsNumber() @Min(0) qtyXa?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsNumber() @Min(0) qtyTrungDoan?: number;
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsNumber() @Min(0) qtyCanCu?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class SaveAllocationLinesDto {
  @ApiProperty({ type: [AllocationLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationLineDto)
  lines!: AllocationLineDto[];
}

export class AllocationReviewDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  note?: string;
}
