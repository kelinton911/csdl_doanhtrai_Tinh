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
import { READINESS_STATES } from '../readiness-material.constants';

const STATES = READINESS_STATES as unknown as string[];

export class ListReadinessMaterialsQuery extends PaginationQuery {
  @ApiPropertyOptional({ description: 'Lọc theo xã/phường' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ enum: READINESS_STATES, description: 'Lọc theo mức SSCĐ' })
  @IsOptional()
  @IsIn(STATES)
  readinessState?: string;

  @ApiPropertyOptional({ description: 'Lọc theo trạng thái workflow (vd PENDING_REVIEW)' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateReadinessMaterialPlanDto {
  @ApiProperty({ description: 'UUID xã/phường' })
  @IsUUID()
  areaId!: string;

  @ApiProperty({ enum: READINESS_STATES, description: 'Mức SSCĐ của bản khai báo' })
  @IsIn(STATES)
  readinessState!: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị quản lý' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReadinessMaterialPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// Một dòng vật chất (khung KKDT: số lượng theo cấp chất lượng 1–5).
export class ReadinessMaterialLineDto {
  @ApiProperty({ description: 'UUID vật chất (danh mục)' })
  @IsUUID()
  materialId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unitCode?: string;

  @ApiPropertyOptional({ example: 0, minimum: 0 })
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// Lưu toàn bộ dòng của bản (thay thế trọn bộ — thao tác dạng biểu mẫu).
export class SaveLinesDto {
  @ApiProperty({ type: [ReadinessMaterialLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReadinessMaterialLineDto)
  lines!: ReadinessMaterialLineDto[];
}

// Sao chép từ mức liền dưới đã duyệt sang mức đích của cùng xã.
export class CopyFromPreviousDto {
  @ApiProperty({ description: 'UUID xã/phường' })
  @IsUUID()
  areaId!: string;

  @ApiProperty({ enum: READINESS_STATES, description: 'Mức đích (phải cao hơn Thường xuyên)' })
  @IsIn(STATES)
  targetState!: string;
}

export class ReadinessReviewDto {
  @ApiPropertyOptional({ example: 'Thiếu định mức nhóm quân y.' })
  @IsOptional()
  @IsString()
  note?: string;
}
