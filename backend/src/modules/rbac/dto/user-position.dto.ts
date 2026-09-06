import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
} from 'class-validator';

// Bổ nhiệm tài khoản vào một chức vụ (trong một đơn vị).
export class CreateUserPositionDto {
  @ApiProperty({ example: 'uuid-user' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'uuid-chuc-vu' })
  @IsString()
  positionId!: string;

  @ApiPropertyOptional({ example: 'uuid-don-vi' })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'ISO date' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Số/ký hiệu quyết định bổ nhiệm' })
  @IsOptional()
  @IsString()
  appointmentDoc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// Miễn nhiệm: kết thúc bổ nhiệm tại thời điểm endDate (mặc định hiện tại).
export class EndUserPositionDto {
  @ApiPropertyOptional({ description: 'ISO date; mặc định = hiện tại' })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
