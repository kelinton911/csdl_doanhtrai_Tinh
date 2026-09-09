import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Scoped } from '../../common/scope/scope.decorator';
import { DataQualityService } from './data-quality.service';

// §6 Hardening — Chất lượng dữ liệu toàn hệ. Lọc theo data-scope đơn vị (SYS-BR-08).
@ApiTags('Vận hành')
@ApiBearerAuth()
@Controller('data-quality')
export class DataQualityController {
  constructor(private readonly service: DataQualityService) {}

  @Get('system')
  @Scoped('organization')
  @ApiOperation({ summary: 'Báo cáo DQ toàn hệ: tồn âm, dataset lệch, định mức chưa căn cứ, outbox lỗi' })
  system(@CurrentUser() user: AuthUser) {
    return this.service.systemReport(user);
  }
}
