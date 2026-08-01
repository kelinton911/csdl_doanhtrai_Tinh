import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

// M28 — Phân tích, dự báo & phát hiện bất thường.
@ApiTags('Analytics (M28)')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Tổng hợp cảnh báo sớm: rủi ro xuống cấp/bất thường/ưu tiên/chất lượng dữ liệu' })
  overview() {
    return this.service.overview();
  }

  @Get('degradation')
  @ApiOperation({ summary: 'Dự báo xuống cấp công trình (điểm rủi ro theo tuổi + tình trạng)' })
  degradation(@Query('limit') limit?: string) {
    return this.service.degradation(limit ? parseInt(limit, 10) : 30);
  }

  @Get('consumption-anomalies')
  @ApiOperation({ summary: 'Phát hiện tiêu thụ điện/nước bất thường (lệch so với trung bình)' })
  consumptionAnomalies(@Query('threshold') threshold?: string) {
    return this.service.consumptionAnomalies(threshold ? parseInt(threshold, 10) : 40);
  }

  @Get('priorities')
  @ApiOperation({ summary: 'Đề xuất thứ tự ưu tiên đầu tư/sửa chữa/xử lý' })
  priorities() {
    return this.service.priorities();
  }

  @Get('data-quality')
  @ApiOperation({ summary: 'Quét bất thường/thiếu sót dữ liệu cần rà soát' })
  dataQuality() {
    return this.service.dataQuality();
  }
}
