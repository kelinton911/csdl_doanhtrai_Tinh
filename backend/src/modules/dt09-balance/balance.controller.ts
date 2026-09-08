import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BalanceService } from './balance.service';
import {
  CreatePlanDto,
  ExecutionFeedbackDto,
  ExecutionRequestDto,
  ReservationDto,
} from './dto/dt09.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { PaginationQuery } from '../../common/dto/pagination.dto';

// DT-09 — Cân đối bảo đảm: kế hoạch/giữ chỗ/execution/snapshot (Quyển IX §XVIII).
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-09 Cân đối bảo đảm')
@ApiBearerAuth()
@Controller()
export class BalanceController {
  constructor(private readonly service: BalanceService) {}

  @Get('balance-plans')
  list(@Query() q: PaginationQuery) {
    return this.service.listPlans(q);
  }

  @Post('balance-plans')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Lập kế hoạch cân đối — nhận supply_required từ 1 run DT-08 (KHÔNG tính lại NC)' })
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    return this.service.createPlan(dto, user);
  }

  @Get('balance-plans/:id')
  get(@Param('id') id: string) {
    return this.service.getPlan(id);
  }

  @Post('balance-plans/:id/revise')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Tạo bản sửa (clone) kế hoạch cân đối' })
  revise(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.revise(id, user);
  }

  @Post('balance-plans/:id/balance')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Tổng hợp giữ chỗ → planned_source_qty + gap từng dòng (DRAFT→BALANCED)' })
  balance(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.balance(id, user);
  }

  @Post('balance-plans/:id/approve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Phê duyệt kế hoạch (BALANCED→APPROVED)' })
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post('balance-plans/:id/lock')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Khóa + sinh snapshot cân đối bất biến + fingerprint (BR-020)' })
  lock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.lock(id, user);
  }

  @Get('balance-plans/:id/gap-summary')
  @ApiOperation({ summary: 'Tổng hợp gap + đã giao (delivered) theo vật chất' })
  gapSummary(@Param('id') id: string) {
    return this.service.gapSummary(id);
  }

  @Post('balance-lines/:id/reservations')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Giữ chỗ nguồn (Σ ACTIVE ≤ available; chống overbooking, BR-008)' })
  reserve(@Param('id') id: string, @Body() dto: ReservationDto, @CurrentUser() user: AuthUser) {
    return this.service.reserve(id, dto, user);
  }

  @Post('reservations/:id/release')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Trả chỗ (RELEASED) → cập nhật lại planned/gap' })
  release(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.release(id, user);
  }

  @Post('balance-lines/:id/execution-requests')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Sinh yêu cầu thực thi → (tùy chọn) chứng từ DT-05 (BR-028)' })
  execute(@Param('id') id: string, @Body() dto: ExecutionRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.createExecutionRequest(id, dto, user);
  }

  @Post('execution-requests/:id/feedback')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Phản hồi thực thi → cập nhật delivered + gap' })
  feedback(@Param('id') id: string, @Body() dto: ExecutionFeedbackDto, @CurrentUser() user: AuthUser) {
    return this.service.feedback(id, dto, user);
  }
}
