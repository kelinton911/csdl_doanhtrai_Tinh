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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import {
  AcceptDto,
  CreateDamageEventDto,
  CreateMaintenanceRequestDto,
  DamageQuery,
  MaintenanceQuery,
  StartDto,
  UpdateDamageEventDto,
} from './dto/maintenance.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// M09 — Maintenance & Recovery. UC-13/14.
@ApiTags('Maintenance & Recovery (M09)')
@ApiBearerAuth()
@Controller()
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  // ------- Hư hỏng -------
  @Get('damage-events')
  @ApiOperation({ summary: 'UC-13: Danh sách sự kiện hư hỏng' })
  listDamages(@Query() q: DamageQuery) {
    return this.service.listDamages(q, { entityId: q.entityId, status: q.status });
  }

  @Post('damage-events')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-13: Ghi nhận hư hỏng (mô phỏng gắn scenario=true)' })
  createDamage(@Body() dto: CreateDamageEventDto, @CurrentUser() user: AuthUser) {
    return this.service.createDamage(dto, user);
  }

  @Put('damage-events/:id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-13: Cập nhật sự kiện (chưa xác minh)' })
  updateDamage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDamageEventDto) {
    return this.service.updateDamage(id, dto);
  }

  @Post('damage-events/:id/verify')
  @Roles(Role.BARRACKS_OFFICER, Role.REVIEWER)
  @ApiOperation({ summary: 'UC-13: Xác minh sự kiện hư hỏng' })
  verifyDamage(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.verifyDamage(id, user);
  }

  // ------- Yêu cầu sửa chữa -------
  @Get('maintenance-requests')
  @ApiOperation({ summary: 'UC-14: Danh sách yêu cầu sửa chữa' })
  listRequests(@Query() q: MaintenanceQuery) {
    return this.service.listRequests(q, { status: q.status, barracksId: q.barracksId });
  }

  @Get('maintenance-requests/:id')
  @ApiOperation({ summary: 'UC-14: Chi tiết yêu cầu' })
  getRequest(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getRequest(id);
  }

  @Post('maintenance-requests')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER)
  @ApiOperation({ summary: 'UC-14: Lập yêu cầu sửa chữa (DRAFT)' })
  createRequest(@Body() dto: CreateMaintenanceRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.createRequest(dto, user);
  }

  @Post('maintenance-requests/:id/submit')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER)
  @ApiOperation({ summary: 'UC-14: Trình thẩm định (PROPOSED)' })
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.submit(id);
  }

  @Post('maintenance-requests/:id/approve')
  @Roles(Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-14: Phê duyệt (người lập không tự duyệt)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post('maintenance-requests/:id/start')
  @Roles(Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-14: Bắt đầu thực hiện (IN_PROGRESS) + phân công kỹ thuật viên' })
  start(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StartDto) {
    return this.service.start(id, dto);
  }

  @Post('maintenance-requests/:id/accept')
  @Roles(Role.BARRACKS_OFFICER, Role.REVIEWER)
  @ApiOperation({ summary: 'UC-14: Nghiệm thu (ACCEPTED)' })
  accept(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AcceptDto) {
    return this.service.accept(id, dto);
  }

  @Post('maintenance-requests/:id/close')
  @Roles(Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-14: Đóng yêu cầu (CLOSED)' })
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(id);
  }
}
