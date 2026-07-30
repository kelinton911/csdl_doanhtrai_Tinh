import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

// Tạo nhóm vật chất (mặc định là nhóm CỤC BỘ do đơn vị tự tạo). Mã tự sinh nếu bỏ trống.
export class CreateMaterialGroupDto {
  @ApiProperty({ example: 'Máy bơm nước' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ description: 'Bỏ trống để hệ thống tự sinh mã cục bộ' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Mã nhóm cha; bỏ trống = nhóm cấp cao (ngành)' })
  @IsOptional()
  @IsString()
  parentCode?: string;

  @ApiPropertyOptional({ example: 'V', description: 'Số thứ tự hiển thị' })
  @IsOptional()
  @IsString()
  ordinal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

// Sửa nhóm — cho phép sửa cả nhóm đã phát hành (đánh dấu user_edited để seeder không ghi đè).
export class UpdateMaterialGroupDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ordinal?: string;

  @ApiPropertyOptional({ description: 'Đổi nhóm cha (di chuyển nhánh). Rỗng = đưa lên cấp cao.' })
  @IsOptional()
  @IsString()
  parentCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'INACTIVE'])
  status?: string;
}

// Chuyển một vật chất sang nhóm khác (đổi categoryCode).
export class MoveMaterialDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  materialId!: string;

  @ApiProperty({ example: 'R00.00.05.01.01.000', description: 'Mã nhóm đích' })
  @IsString()
  @MinLength(1)
  targetGroupCode!: string;
}
