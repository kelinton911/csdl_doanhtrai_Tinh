import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';
import { AllocationCategory, AllocationSemantics } from './alloc-rules';

export class CreateAllocationTypeDto {
  @ApiProperty() @IsString() code!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional({ enum: AllocationSemantics }) @IsOptional() @IsEnum(AllocationSemantics) semantics?: AllocationSemantics;
  @ApiPropertyOptional({ enum: AllocationCategory }) @IsOptional() @IsEnum(AllocationCategory) category?: AllocationCategory;
  @ApiPropertyOptional() @IsOptional() @IsInt() priorityDefault?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresApproval?: boolean;
}

export class CreateAllocationDto {
  @ApiProperty() @IsUUID() allocationTypeId!: string;
  @ApiProperty() @IsUUID() organizationId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() missionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
}

export class AddAllocationLineDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsNumber() quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() priority?: number;
}

export class CreateHoldDto {
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsNumber() quantityReserved!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() missionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() priority?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() basisDocumentId?: string;
}

export class CreateReserveLinkDto {
  @ApiProperty() @IsUUID() allocationId!: string;
  @ApiProperty() @IsUUID() materialCatalogId!: string;
  @ApiProperty() @IsNumber() requiredQty!: number;
  @ApiProperty() @IsNumber() allocatedQty!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() normReference?: string;
}

export class CreateChangeRequestDto {
  @ApiProperty() @IsUUID() holdId!: string;
  @ApiProperty() @IsUUID() toTypeId!: string;
  @ApiProperty() @IsNumber() quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CreateSnapshotDto {
  @ApiProperty() @IsString() snapshotCode!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cutoffTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() organizationId?: string;
}

export class CreateSlowRuleDto {
  @ApiProperty() @IsString() ruleVersion!: string;
  @ApiProperty() @IsObject() criteriaJson!: Record<string, unknown>;
}
