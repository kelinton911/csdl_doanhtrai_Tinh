import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum QueueJobType {
  HEAVY_REPORT_GENERATION = 'HEAVY_REPORT_GENERATION',
  SCENARIO_CALCULATION = 'SCENARIO_CALCULATION',
  LOGISTICS_AUDIT = 'LOGISTICS_AUDIT',
  DATA_SYNC_PROCESSING = 'DATA_SYNC_PROCESSING',
}

export class CreateQueueJobDto {
  @ApiProperty({ enum: QueueJobType, description: 'Loại tác vụ ngầm cần đẩy vào hàng đợi' })
  @IsEnum(QueueJobType)
  @IsNotEmpty()
  jobType!: QueueJobType;

  @ApiPropertyOptional({ description: 'Các tham số đầu vào cho tác vụ' })
  @IsOptional()
  payload?: Record<string, unknown>;
}
