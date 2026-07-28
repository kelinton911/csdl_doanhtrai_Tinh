import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAreaDto {
  @ApiProperty({ example: 'XA-A01' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Xã A01' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: ['COMMUNE', 'WARD'], default: 'COMMUNE' })
  @IsOptional()
  @IsIn(['COMMUNE', 'WARD'])
  type?: string;
}
