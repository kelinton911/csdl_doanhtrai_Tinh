import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ConflictSeverity } from '../rbac.enums';

// Khai báo cặp chức năng xung đột trách nhiệm (SoD).
export class CreateConflictDto {
  @ApiProperty({ example: 'BUDGET_CREATE' })
  @IsString()
  functionCodeA!: string;

  @ApiProperty({ example: 'BUDGET_APPROVE' })
  @IsString()
  functionCodeB!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ConflictSeverity, default: ConflictSeverity.BLOCK })
  @IsOptional()
  @IsEnum(ConflictSeverity)
  severity?: ConflictSeverity;
}

export class UpdateConflictDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ConflictSeverity })
  @IsOptional()
  @IsEnum(ConflictSeverity)
  severity?: ConflictSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
