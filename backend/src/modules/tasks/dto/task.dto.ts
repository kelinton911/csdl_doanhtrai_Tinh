import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export const TASK_CATEGORIES = ['PLAN', 'DECLARATION', 'INSPECTION_TASK', 'REPORT', 'CONSTRUCTION', 'MAINTENANCE', 'OTHER'] as const;
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const UPDATE_KINDS = ['PROGRESS', 'COMMENT'] as const;

export class CreateTaskDto {
  @ApiProperty({ example: 'NV-2026-001' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Rà soát, cập nhật hồ sơ doanh trại xã' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: TASK_CATEGORIES }) @IsOptional() @IsIn(TASK_CATEGORIES as unknown as string[]) category?: string;
  @ApiPropertyOptional({ enum: TASK_PRIORITIES }) @IsOptional() @IsIn(TASK_PRIORITIES as unknown as string[]) priority?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() assigneeOrgId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeAreaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeUserId?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() dueDate?: string;
  @ApiPropertyOptional({ example: 100 }) @IsOptional() @IsNumber() targetValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() targetUnit?: string;

  @ApiPropertyOptional({ description: 'UUID nhiệm vụ cha (kế hoạch công tác)' }) @IsOptional() @IsString() parentTaskId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkedEntityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() linkedEntityId?: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ minimum: 0 }) @IsOptional() @IsNumber() resultValue?: number;
}

export class SubmitDto {
  @ApiPropertyOptional() @IsOptional() @IsString() resultNote?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() resultValue?: number;
}

export class ReviewTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class TaskUpdateDto {
  @ApiPropertyOptional({ enum: UPDATE_KINDS }) @IsOptional() @IsIn(UPDATE_KINDS as unknown as string[]) kind?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @IsOptional() @IsInt() @Min(0) @Max(100) progressPercent?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
