import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export const FUNDING_SOURCES = ['DEFENSE_BUDGET', 'STATE_BUDGET', 'LOCAL', 'OTHER'] as const;
export const LINE_CATEGORIES = ['CONSTRUCTION', 'MAINTENANCE', 'EQUIPMENT', 'UTILITY', 'MATERIAL', 'OTHER'] as const;

export class CreateBudgetPlanDto {
  @ApiProperty({ example: 'NS-2026-DT' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Dự toán ngân sách doanh trại 2026' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  fiscalYear!: number;

  @ApiPropertyOptional({ enum: FUNDING_SOURCES }) @IsOptional() @IsIn(FUNDING_SOURCES as unknown as string[]) fundingSource?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() organizationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional({ example: 12000000000 }) @IsOptional() @IsNumber() plannedAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateBudgetPlanDto extends PartialType(CreateBudgetPlanDto) {}

export class CreateBudgetLineDto {
  @ApiProperty({ example: 'Cải tạo nhà làm việc' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: LINE_CATEGORIES }) @IsOptional() @IsIn(LINE_CATEGORIES as unknown as string[]) category?: string;
  @ApiProperty({ example: 2000000000 }) @IsNumber() @Min(0) allocatedAmount!: number;
  @ApiPropertyOptional({ description: 'UUID dự án (M13) liên kết' }) @IsOptional() @IsString() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class UpdateBudgetLineDto extends PartialType(CreateBudgetLineDto) {}

export class CreateExpenseDto {
  @ApiProperty({ example: '2026-07-15', description: 'YYYY-MM-DD' })
  @IsString()
  expenseDate!: string;

  @ApiProperty({ example: 500000000 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional() @IsOptional() @IsString() budgetLineId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() voucherNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectId?: string;
}
