import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ActionType } from '../rbac.enums';

export class CreateFunctionDto {
  @ApiProperty({ example: 'BARRACKS_UPDATE' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Cập nhật doanh trại' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'BARRACKS' })
  @IsString()
  module!: string;

  @ApiPropertyOptional({ enum: ActionType, default: ActionType.VIEW })
  @IsOptional()
  @IsEnum(ActionType)
  actionType?: ActionType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;
}

export class UpdateFunctionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ActionType })
  @IsOptional()
  @IsEnum(ActionType)
  actionType?: ActionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
