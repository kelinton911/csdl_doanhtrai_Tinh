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

  // COMMUNE = Xã, WARD = Phường, SPECIAL_ZONE = Đặc khu (cấp xã sau sáp nhập 2025).
  @ApiProperty({ enum: ['COMMUNE', 'WARD', 'SPECIAL_ZONE'], default: 'COMMUNE' })
  @IsOptional()
  @IsIn(['COMMUNE', 'WARD', 'SPECIAL_ZONE'])
  type?: string;
}
