import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Role } from '../roles';

export class CreateUserDto {
  @ApiProperty({ example: 'canbo01' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: 'admin@123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  fullName!: string;

  @ApiProperty({ enum: Role, isArray: true, example: [Role.COMMUNE_USER] })
  @IsArray()
  @IsEnum(Role, { each: true })
  roles!: Role[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class AssignRolesDto {
  @ApiProperty({ enum: Role, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(Role, { each: true })
  roles!: Role[];
}

export class ScopeItemDto {
  @ApiProperty({ example: 'ORGANIZATION' })
  @IsString()
  type!: string;

  @ApiProperty({ example: 'uuid-đơn-vị' })
  @IsString()
  refId!: string;
}

export class AssignScopesDto {
  @ApiProperty({ type: [ScopeItemDto] })
  @IsArray()
  scopes!: ScopeItemDto[];
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'MatKhauMoi@123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}
