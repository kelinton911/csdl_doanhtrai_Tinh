import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  ReviewTaskDto,
  SubmitDto,
  TaskUpdateDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

const ASSIGN = [Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN];
const EXECUTE = [Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN, Role.COMMUNE_USER, Role.REVIEWER];

class TaskQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeAreaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentTaskId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() topLevel?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mine?: string;
}

// M21 — Kế hoạch công tác & giao nhiệm vụ.
@ApiTags('Tasks (M21)')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nhiệm vụ (lọc trạng thái/ưu tiên/loại; mine=true = của tôi)' })
  list(@Query() q: TaskQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp nhiệm vụ (đang thực hiện/đã nộp/hoàn thành/quá hạn)' })
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem nhiệm vụ (kèm nhiệm vụ con)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/updates')
  @ApiOperation({ summary: 'Nhật ký cập nhật nhiệm vụ' })
  updates(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listUpdates(id);
  }

  @Post()
  @Roles(...ASSIGN)
  @ApiOperation({ summary: 'Giao nhiệm vụ mới (ASSIGNED)' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(...ASSIGN)
  @ApiOperation({ summary: 'Cập nhật nhiệm vụ' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/start')
  @Roles(...EXECUTE)
  @ApiOperation({ summary: 'Bắt đầu thực hiện' })
  start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.start(id, user);
  }

  @Post(':id/submit')
  @Roles(...EXECUTE)
  @ApiOperation({ summary: 'Nộp kết quả (IN_PROGRESS → SUBMITTED)' })
  submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SubmitDto, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, dto, user);
  }

  @Post(':id/accept')
  @Roles(...ASSIGN)
  @ApiOperation({ summary: 'Nghiệm thu, hoàn thành (SUBMITTED → COMPLETED)' })
  accept(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.accept(id, user);
  }

  @Post(':id/reject')
  @Roles(...ASSIGN)
  @ApiOperation({ summary: 'Trả lại nhiệm vụ (SUBMITTED → IN_PROGRESS)' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewTaskDto, @CurrentUser() user: AuthUser) {
    return this.service.reject(id, dto, user);
  }

  @Post(':id/cancel')
  @Roles(...ASSIGN)
  @ApiOperation({ summary: 'Hủy nhiệm vụ' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.cancel(id, user);
  }

  @Post(':id/updates')
  @Roles(...EXECUTE)
  @ApiOperation({ summary: 'Ghi nhật ký tiến độ / trao đổi' })
  addUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TaskUpdateDto, @CurrentUser() user: AuthUser) {
    return this.service.addUpdate(id, dto, user);
  }
}
