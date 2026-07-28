import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'DV-BB01' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Ban CHQS xã A01' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: ['PROVINCE', 'COMMUNE', 'UNIT'], default: 'UNIT' })
  @IsOptional()
  @IsIn(['PROVINCE', 'COMMUNE', 'UNIT'])
  type?: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị cấp trên' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['PROVINCE', 'COMMUNE', 'UNIT'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}
