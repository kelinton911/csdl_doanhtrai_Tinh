import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQuery } from '../../../common/dto/pagination.dto';

export class CreateDamageEventDto {
  @ApiProperty({ enum: ['barracks', 'facility'] })
  @IsIn(['barracks', 'facility'])
  entityType!: string;

  @ApiProperty()
  @IsUUID()
  entityId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  causeCode?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' })
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedLoss?: number;

  @ApiPropertyOptional({ description: 'Dữ liệu mô phỏng (tình huống giả định)' })
  @IsOptional()
  @IsBoolean()
  scenario?: boolean;
}

export class UpdateDamageEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  causeCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedLoss?: number;
}

export class CreateMaintenanceRequestDto {
  @ApiProperty({ example: 'SC-2026-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  barracksId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  damageEventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'], default: 'NORMAL' })
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: string;

  @ApiPropertyOptional({ default: 0, description: 'Kinh phí dự kiến (đồng)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedDays?: number;

  @ApiPropertyOptional({ description: 'Kỹ thuật viên/nhà thầu được phân công' })
  @IsOptional()
  @IsString()
  assigneeName?: string;
}

export class StartDto {
  @ApiPropertyOptional({ description: 'Phân công kỹ thuật viên khi bắt đầu thực hiện' })
  @IsOptional()
  @IsString()
  assigneeName?: string;
}

export class AcceptDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class DamageQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class MaintenanceQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barracksId?: string;
}
