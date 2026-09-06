import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllocationService } from './allocation.service';
import { AllocationStatus } from './alloc-rules';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { Scoped } from '../../common/scope/scope.decorator';
import {
  AddAllocationLineDto,
  CreateAllocationDto,
  CreateAllocationTypeDto,
  CreateChangeRequestDto,
  CreateHoldDto,
  CreateReserveLinkDto,
  CreateSlowRuleDto,
  CreateSnapshotDto,
} from './dt06.dto';

// DT-06 — Dự trữ & phân bổ (Quyển VI §XVI). Lớp phủ trên HC DT-04.
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-06 Dự trữ & phân bổ')
@ApiBearerAuth()
@Controller()
export class AllocationController {
  constructor(private readonly service: AllocationService) {}

  // ---- Types ----
  @Get('allocation-types')
  listTypes() {
    return this.service.listTypes();
  }
  @Post('allocation-types')
  @Roles(...APPROVERS)
  createType(@Body() dto: CreateAllocationTypeDto, @CurrentUser() user: AuthUser) {
    return this.service.createType(dto, user);
  }

  // ---- Allocatable (HC_ALLOCATABLE) — đặt trước route động ----
  @Get('allocations/allocatable')
  @Scoped('organization')
  @ApiOperation({ summary: 'HC khả dụng để phân bổ (HC − đã khóa exclusive)' })
  allocatable(@Query('materialCatalogId') mat: string, @Query('organizationId') org: string) {
    return this.service.allocatable(mat, org);
  }

  @Get('reserve/sscd')
  @ApiOperation({ summary: 'PC_SSCĐ (SEM-RESERVE-SSCD) cho DT-08' })
  reserveSscd(@Query('organizationId') org: string) {
    return this.service.reserveSscd(org || undefined);
  }

  // ---- Allocations ----
  @Post('allocations')
  @Roles(...WRITERS)
  createAllocation(@Body() dto: CreateAllocationDto, @CurrentUser() user: AuthUser) {
    return this.service.createAllocation(dto, user);
  }

  @Get('allocations/:id')
  getAllocation(@Param('id') id: string) {
    return this.service.getAllocation(id);
  }

  @Post('allocations/:id/lines')
  @Roles(...WRITERS)
  addLine(@Param('id') id: string, @Body() dto: AddAllocationLineDto, @CurrentUser() user: AuthUser) {
    return this.service.addLine(id, dto, user);
  }

  @Post('allocations/:id/submit')
  @Roles(...WRITERS)
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionAllocation(id, AllocationStatus.SUBMITTED, user);
  }

  @Post('allocations/:id/approve')
  @Roles(...APPROVERS)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionAllocation(id, AllocationStatus.APPROVED, user);
  }

  @Post('allocations/:id/holds')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Khóa nguồn (Σ exclusive ≤ HC_ALLOCATABLE — BR-DT06-002)' })
  createHold(@Param('id') id: string, @Body() dto: CreateHoldDto, @CurrentUser() user: AuthUser) {
    return this.service.createHold(id, dto, user);
  }

  @Get('allocations/:id/reserve-links')
  listReserveLinks(@Param('id') id: string) {
    return this.service.listReserveLinks(id);
  }

  // ---- Holds ----
  @Post('holds/:id/release')
  @Roles(...WRITERS)
  releaseHold(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.releaseHold(id, user);
  }

  // ---- Reserve requirement link ----
  @Post('reserve-links')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Đối chiếu định mức DT-07 (thiếu/đủ/vượt)' })
  createReserveLink(@Body() dto: CreateReserveLinkDto, @CurrentUser() user: AuthUser) {
    return this.service.createReserveLink(dto, user);
  }

  // ---- Change requests (chuyển loại) ----
  @Post('allocation-change-requests')
  @Roles(...WRITERS)
  createChangeRequest(@Body() dto: CreateChangeRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.createChangeRequest(dto, user);
  }
  @Post('allocation-change-requests/:id/approve')
  @Roles(...APPROVERS)
  approveChangeRequest(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveChangeRequest(id, user);
  }

  // ---- Snapshots ----
  @Post('allocation-snapshots')
  @Roles(...APPROVERS)
  createSnapshot(@Body() dto: CreateSnapshotDto, @CurrentUser() user: AuthUser) {
    return this.service.createSnapshot(dto, user);
  }
  @Post('allocation-snapshots/:id/lock')
  @Roles(...APPROVERS)
  lockSnapshot(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.lockSnapshot(id, user);
  }
  @Get('allocation-snapshots/:id/lines')
  snapshotLines(@Param('id') id: string) {
    return this.service.snapshotLinesOf(id);
  }

  // ---- Slow-moving ----
  @Post('slow-moving/rules')
  @Roles(...APPROVERS)
  createSlowRule(@Body() dto: CreateSlowRuleDto, @CurrentUser() user: AuthUser) {
    return this.service.createSlowRule(dto, user);
  }
  @Post('slow-moving/evaluate/:ruleId')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Đánh giá chậm luân chuyển (overlay, không đổi HC)' })
  evaluateSlow(@Param('ruleId') ruleId: string, @Query('organizationId') org: string) {
    return this.service.evaluateSlowMoving(ruleId, org || undefined);
  }
}
