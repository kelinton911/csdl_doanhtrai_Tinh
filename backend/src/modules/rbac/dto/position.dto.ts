import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FunctionScope, PositionScope } from '../rbac.enums';

export class CreatePositionDto {
  @ApiProperty({ example: 'BARRACKS_OFFICER' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Trợ lý doanh trại' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PositionScope, default: PositionScope.UNIT })
  @IsOptional()
  @IsEnum(PositionScope)
  positionScope?: PositionScope;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  level?: number;
}

export class UpdatePositionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PositionScope })
  @IsOptional()
  @IsEnum(PositionScope)
  positionScope?: PositionScope;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  level?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Một mục gán trong ma trận: functionId + scope.
export class PositionFunctionItemDto {
  @ApiProperty({ example: 'uuid-chuc-nang' })
  @IsString()
  functionId!: string;

  @ApiProperty({ enum: FunctionScope, default: FunctionScope.UNIT })
  @IsEnum(FunctionScope)
  scope!: FunctionScope;
}

// Đặt lại toàn bộ ma trận chức năng cho một chức vụ (thay thế danh sách hiện tại).
export class SetPositionFunctionsDto {
  @ApiProperty({ type: [PositionFunctionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionFunctionItemDto)
  functions!: PositionFunctionItemDto[];
}
