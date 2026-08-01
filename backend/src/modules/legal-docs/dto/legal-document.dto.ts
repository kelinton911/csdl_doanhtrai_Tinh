import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const DOC_TYPES = ['LAW', 'DECREE', 'CIRCULAR', 'DECISION', 'REGULATION', 'STANDARD', 'NORM', 'GUIDELINE', 'PLAN', 'OTHER'] as const;
export const EFFECTIVE_STATUSES = ['DRAFT', 'EFFECTIVE', 'EXPIRED', 'SUPERSEDED', 'REVOKED'] as const;
export const DOC_FIELDS = ['DOANH_TRAI', 'DAT_DAI', 'VAT_CHAT', 'TAI_CHINH', 'XDCB', 'DIEN_NUOC', 'KIEM_TRA', 'CHUNG'] as const;
export const CONFIDENTIALITIES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'] as const;

export class CreateLegalDocDto {
  @ApiProperty({ example: 'VB-2837-DT' })
  @IsString()
  @MinLength(3)
  code!: string;

  @ApiProperty({ example: '2837/DT-QLDT' })
  @IsString()
  @MinLength(1)
  docNumber!: string;

  @ApiProperty({ example: 'Danh mục tài sản ngành doanh trại' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiPropertyOptional({ enum: DOC_TYPES }) @IsOptional() @IsIn(DOC_TYPES as unknown as string[]) docType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() issuingBody?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() issuedDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() effectiveDate?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD' }) @IsOptional() @IsString() expiryDate?: string;
  @ApiPropertyOptional({ enum: EFFECTIVE_STATUSES }) @IsOptional() @IsIn(EFFECTIVE_STATUSES as unknown as string[]) effectiveStatus?: string;
  @ApiPropertyOptional({ enum: DOC_FIELDS }) @IsOptional() @IsIn(DOC_FIELDS as unknown as string[]) field?: string;
  @ApiPropertyOptional({ enum: CONFIDENTIALITIES }) @IsOptional() @IsIn(CONFIDENTIALITIES as unknown as string[]) confidentiality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() summary?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() keywords?: string;
  @ApiPropertyOptional({ description: 'UUID văn bản bị thay thế' }) @IsOptional() @IsString() supersedesId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sourceUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateLegalDocDto extends PartialType(CreateLegalDocDto) {}
