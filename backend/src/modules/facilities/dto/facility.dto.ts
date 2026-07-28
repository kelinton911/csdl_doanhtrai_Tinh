import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { FacilityStatus } from '../facility-status';

export class CreateFacilityDto {
  @ApiProperty({ example: 'CT-01' })
  @IsString()
  @MinLength(2)
  code!: string;

  @ApiProperty({ example: 'Nhà ở đại đội 1' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'NHA_O' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 250.5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  area?: number;

  @ApiPropertyOptional({ example: 120, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  declaredCapacity?: number;

  @ApiPropertyOptional({ example: 2015 })
  @IsOptional()
  @IsInt()
  @Min(1800)
  buildYear?: number;

  @ApiPropertyOptional({ enum: ['GOOD', 'FAIR', 'POOR'] })
  @IsOptional()
  @IsIn(['GOOD', 'FAIR', 'POOR'])
  condition?: string;

  @ApiPropertyOptional({ enum: FacilityStatus })
  @IsOptional()
  @IsIn(Object.values(FacilityStatus))
  status?: FacilityStatus;

  @ApiPropertyOptional({ example: { type: 'Point', coordinates: [0, 0] } })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };
}

export class UpdateFacilityDto extends PartialType(CreateFacilityDto) {}

export class DecommissionDto {
  @ApiProperty({ example: 'Xuống cấp không thể khai thác.' })
  @IsString()
  @MinLength(3)
  reason!: string;
}
