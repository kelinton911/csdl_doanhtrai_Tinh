import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateBarracksDto {
  @ApiProperty({ example: 'DT-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Doanh trại giả lập 01' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ description: 'UUID xã/phường' })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({ description: 'UUID đơn vị quản lý' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ example: 300, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  declaredCapacity?: number;

  @ApiPropertyOptional({
    description: 'GeoJSON Point (giả lập). Ví dụ: {"type":"Point","coordinates":[0,0]}',
    example: { type: 'Point', coordinates: [0, 0] },
  })
  @IsOptional()
  @IsObject()
  location?: { type: 'Point'; coordinates: [number, number] };
}

// Cập nhật: chỉ các trường cho phép; mã doanh trại cố định sau khi tạo.
export class UpdateBarracksDto extends PartialType(CreateBarracksDto) {}

export class ReviewDecisionDto {
  @ApiPropertyOptional({ example: 'Thiếu minh chứng pháp lý.' })
  @IsOptional()
  @IsString()
  note?: string;
}
