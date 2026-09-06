import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';
import { FunctionScope } from '../rbac.enums';

// Cấp quyền lẻ cho tài khoản (ngoài chức vụ).
export class CreateGrantDto {
  @ApiProperty({ example: 'uuid-user' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'REPORT_EXPORT' })
  @IsString()
  functionCode!: string;

  @ApiProperty({ enum: FunctionScope, default: FunctionScope.UNIT })
  @IsEnum(FunctionScope)
  scope!: FunctionScope;

  @ApiPropertyOptional({ example: 'uuid-don-vi' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'ISO date; null = không hết hạn' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokeGrantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
