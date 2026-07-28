import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { AlertsService } from './alerts.service';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class AlertQuery extends PaginationQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  severity?: string;
}

// M13 — Alert & Notification. UC-18.
@ApiTags('Alerts (M13)')
@ApiBearerAuth()
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'UC-18: Danh sách cảnh báo' })
  list(@Query() q: AlertQuery) {
    return this.service.list(q, { status: q.status, severity: q.severity });
  }

  @Get('summary')
  @ApiOperation({ summary: 'UC-18: Tổng hợp cảnh báo theo mức độ' })
  summary() {
    return this.service.summary();
  }

  @Post('generate')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-18: Sinh cảnh báo từ dữ liệu (rule engine)' })
  generate() {
    return this.service.generate();
  }

  @Post(':id/assign')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'UC-18: Giao xử lý cảnh báo' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { assigneeId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assign(id, body.assigneeId, user);
  }

  @Post(':id/close')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'UC-18: Đóng cảnh báo (bắt buộc có kết quả xử lý)' })
  close(@Param('id', ParseUUIDPipe) id: string, @Body() body: { resolution?: string }) {
    return this.service.close(id, body.resolution);
  }
}
