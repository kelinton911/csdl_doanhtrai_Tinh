import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ScenarioParamsDto {
  @ApiProperty({ example: 5000, description: 'Quân số cần bảo đảm' })
  @IsInt()
  @Min(0)
  troopCount!: number;

  @ApiProperty({ example: 30, description: 'Số ngày bảo đảm' })
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiPropertyOptional({ example: 0.2, description: 'Mức hư hỏng hạ tầng (0..1)' })
  @IsOptional()
  @IsNumber()
  damageLevel?: number;

  @ApiPropertyOptional({ description: 'Ghi chú giả định' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateScenarioDto {
  @ApiProperty({ example: 'TH-2026-01' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Tình huống SSCĐ khu vực A' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({ type: ScenarioParamsDto })
  @ValidateNested()
  @Type(() => ScenarioParamsDto)
  parameters!: ScenarioParamsDto;
}

export class CreatePlanDto {
  @ApiProperty({ example: 'PA-2026-01' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: 'Phương án A' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty()
  @IsUUID()
  scenarioRunId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assumptions?: string;
}

export class ComparePlansDto {
  @ApiProperty({ type: [String], description: 'Danh sách id phương án cần so sánh' })
  @IsArray()
  @IsUUID('all', { each: true })
  planIds!: string[];
}
