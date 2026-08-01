import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const COMBAT_TYPES = ['TIEN_CONG', 'PHONG_NGU'] as const;

export class ListNormsQuery {
  @ApiPropertyOptional({ description: 'Lọc theo ngành: QN|QY|XD|VT|DT|QS' })
  @IsOptional()
  @IsString()
  branch?: string;
}

// Tham số tình huống (người lập nhập) để tính bảo đảm HC-KT.
export class ComputeLogisticsDto {
  @ApiProperty({ example: 2331, description: 'Quân số cần bảo đảm' })
  @IsInt()
  @Min(1)
  troopCount!: number;

  @ApiProperty({ example: 5, description: 'Số ngày (ngày đêm) chiến đấu/bảo đảm' })
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiPropertyOptional({ enum: COMBAT_TYPES, description: 'Loại tác chiến (suy ra tỷ lệ thương binh mặc định)' })
  @IsOptional()
  @IsIn(COMBAT_TYPES as unknown as string[])
  combatType?: string;

  @ApiPropertyOptional({ description: 'Ghi đè tỷ lệ thương binh/ngày đêm (%). Bỏ trống = mặc định theo loại tác chiến (tiến công 15%, phòng ngự 9%).' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  casualtyRatePct?: number;
}
