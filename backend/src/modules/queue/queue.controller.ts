import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { CreateQueueJobDto } from './dto/queue-job.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Hàng đợi Tác vụ Ngầm (BullMQ Queue)')
@ApiBearerAuth()
@Controller('queue')
export class QueueController {
  constructor(private readonly service: QueueService) {}

  @Post('jobs')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Khởi tạo tác vụ ngầm mới vào hàng đợi (Report/SSCĐ/Audit)' })
  enqueueJob(@Body() dto: CreateQueueJobDto, @CurrentUser() user: AuthUser) {
    return this.service.enqueueJob(dto, user);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Tra cứu tiến độ (0-100%) và kết quả xử lý của tác vụ ngầm' })
  getJob(@Param('id') id: string) {
    return this.service.getJob(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Thống kê hiệu năng tổng quan hàng đợi BullMQ' })
  getStats() {
    return this.service.getStats();
  }
}
