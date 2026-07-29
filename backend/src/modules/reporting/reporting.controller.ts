import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { ReportingService } from './reporting.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class CreateReportDto {
  @IsString()
  template!: string;

  @IsIn(['pdf', 'excel', 'word'])
  format!: string;
}

// M12 — Reporting & Analytics + Search.
@ApiTags('Reporting & Search (M12)')
@ApiBearerAuth()
@Controller()
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('search')
  @ApiOperation({ summary: 'UC-19: Tìm kiếm toàn cục (doanh trại/công trình/vật chất)' })
  search(@Query('q') q: string) {
    return this.service.search(q ?? '');
  }

  @Get('reports/jobs')
  @ApiOperation({ summary: 'UC-20: Danh sách tác vụ xuất báo cáo' })
  listJobs() {
    return this.service.listJobs();
  }

  @Get('reports/jobs/:id')
  @ApiOperation({ summary: 'UC-20: Trạng thái tác vụ' })
  getJob(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getJob(id);
  }

  @Post('reports/jobs')
  @Roles(Role.BARRACKS_OFFICER, Role.REPORT_VIEWER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-20: Tạo báo cáo (PDF/Excel) từ snapshot dữ liệu' })
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthUser) {
    return this.service.createReport(dto.template, dto.format, user);
  }

  @Get('reports/:id/download-url')
  @ApiOperation({ summary: 'UC-20: URL tải báo cáo (có thời hạn)' })
  downloadUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.downloadUrl(id);
  }
}
