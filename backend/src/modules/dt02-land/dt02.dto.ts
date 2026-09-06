import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { AddressOwnerType, LandChangeType, LandUsageType } from './dt02.enums';

export class CreateAddressSnapshotDto {
  @ApiProperty({ enum: AddressOwnerType }) @IsEnum(AddressOwnerType) ownerType!: AddressOwnerType;
  @ApiProperty() @IsUUID() ownerId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() provinceText?: string;
  @ApiPropertyOptional({ description: 'Huyện/quận lịch sử (chỉ lưu văn bản, không tạo tầng tổ chức)' })
  @IsOptional() @IsString() districtTextLegacy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() communeText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() detailText?: string;
  @ApiProperty({ description: 'Ngày hiệu lực (YYYY-MM-DD)' }) @IsString() effectiveAt!: string;
}

export class CreateAllocationDto {
  @ApiProperty() @IsUUID() landPointId!: string;
  @ApiPropertyOptional({ enum: LandUsageType }) @IsOptional() @IsEnum(LandUsageType) usageType?: LandUsageType;
  @ApiProperty() @IsNumber() areaM2!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() basisDocId?: string;
}

export class CreateChangeDto {
  @ApiProperty() @IsUUID() landPointId!: string;
  @ApiProperty({ enum: LandChangeType }) @IsEnum(LandChangeType) changeType!: LandChangeType;
  @ApiPropertyOptional() @IsOptional() @IsInt() pointDelta?: number;
  @ApiProperty() @IsNumber() areaDeltaM2!: number;
  @ApiProperty({ description: 'Ngày hiệu lực biến động (YYYY-MM-DD)' }) @IsString() effectiveDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() docId?: string;
}
