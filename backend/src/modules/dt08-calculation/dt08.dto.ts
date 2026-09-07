import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CalcPhase } from './calc-rules';

// Một vật chất mục tiêu trong kịch bản: định mức theo giai đoạn + quy mô × ngày.
export class ScenarioMaterialDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() unitId?: string;

  // Giai đoạn cần tính (mặc định cả PREPARATION + COMBAT).
  @ApiPropertyOptional({ enum: CalcPhase, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(CalcPhase, { each: true })
  phases?: CalcPhase[];

  // Quy mô (quân số/đầu mối) — nhân với đơn giá định mức. Mặc định 1.
  @ApiPropertyOptional() @IsOptional() @IsNumber() scale?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() daysPrep?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() daysCombat?: number;
}

// Phạm vi + tham số resolve (các chiều DT-07) + danh sách vật chất.
export class ScenarioScopeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() mission?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() org?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() territory?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phase?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() quality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scale?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() time?: string;

  @ApiProperty({ type: [ScenarioMaterialDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScenarioMaterialDto)
  materials!: ScenarioMaterialDto[];
}

export class CreateScenarioDto {
  @ApiPropertyOptional() @IsOptional() @IsString() scenarioCode?: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() missionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTime?: string;
  // Snapshot HC (DT-04 materiel_snapshot) — HC as-of, không đọc số dư sống (BR-DT08-021).
  @ApiPropertyOptional() @IsOptional() @IsUUID() hcSnapshotId?: string;

  @ApiProperty({ type: ScenarioScopeDto })
  @ValidateNested()
  @Type(() => ScenarioScopeDto)
  scope!: ScenarioScopeDto;
}

// Revise = clone bản mới (based_on_id + revision_no+1) rồi ghi đè các trường tùy chọn.
export class ReviseScenarioDto {
  @ApiPropertyOptional() @IsOptional() @IsString() scenarioCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() hcSnapshotId?: string;
  @ApiPropertyOptional({ type: ScenarioScopeDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ScenarioScopeDto)
  scope?: ScenarioScopeDto;
}
