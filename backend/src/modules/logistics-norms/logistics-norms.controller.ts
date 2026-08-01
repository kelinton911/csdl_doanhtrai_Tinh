import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LogisticsNormsService } from './logistics-norms.service';
import { ComputeLogisticsDto, ListNormsQuery } from './dto/logistics-norms.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// Khâu 4 — Định mức HC-KT (tra cứu) + tính bảo đảm chiến đấu (văn kiện dự thảo).
@ApiTags('Logistics Norms (HC-KT – Khâu 4)')
@ApiBearerAuth()
@Controller('logistics-norms')
export class LogisticsNormsController {
  constructor(private readonly service: LogisticsNormsService) {}

  // Định mức là dữ liệu tra cứu — mở cho mọi vai trò (kể cả xã) để tự khai báo SSCĐ theo chuẩn.
  @Get()
  @ApiOperation({ summary: 'Danh mục định mức HC-KT (lọc theo ngành) — tra cứu' })
  list(@Query() q: ListNormsQuery) {
    return this.service.list(q.branch);
  }

  // Kết quả tính = văn kiện hậu cần chiến đấu (dự thảo) → chỉ cấp Tỉnh + cán bộ được phân quyền.
  @Post('compute')
  @Roles(Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Tính nhu cầu bảo đảm HC-KT theo quy ước (dự thảo, cấp Tỉnh)' })
  compute(@Body() dto: ComputeLogisticsDto) {
    return this.service.compute(dto);
  }
}
