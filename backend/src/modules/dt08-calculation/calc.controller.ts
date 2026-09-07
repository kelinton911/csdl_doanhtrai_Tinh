import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CalcService } from './calc.service';
import { CreateScenarioDto, ReviseScenarioDto } from './dt08.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { PaginationQuery } from '../../common/dto/pagination.dto';

// DT-08 — Engine tính nhu cầu NC = TT + PC_SSCĐ − HC (Quyển VIII §XVIII).
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-08 Tính nhu cầu vật chất')
@ApiBearerAuth()
@Controller()
export class CalcController {
  constructor(private readonly service: CalcService) {}

  // ---- Kịch bản ----
  @Get('calculation-scenarios')
  listScenarios(@Query() q: PaginationQuery) {
    return this.service.listScenarios(q);
  }

  @Post('calculation-scenarios')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Lập kịch bản (nhiệm vụ/phạm vi/effective_time + danh sách vật chất)' })
  createScenario(@Body() dto: CreateScenarioDto, @CurrentUser() user: AuthUser) {
    return this.service.createScenario(dto, user);
  }

  @Get('calculation-scenarios/:id')
  getScenario(@Param('id') id: string) {
    return this.service.getScenario(id);
  }

  @Get('calculation-scenarios/:id/runs')
  listRuns(@Param('id') id: string) {
    return this.service.listRuns(id);
  }

  @Post('calculation-scenarios/:id/revise')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Tạo bản sửa (clone) — LOCKED bất biến buộc revise (BR-DT08-011/012)' })
  revise(@Param('id') id: string, @Body() dto: ReviseScenarioDto, @CurrentUser() user: AuthUser) {
    return this.service.reviseScenario(id, dto, user);
  }

  @Post('calculation-scenarios/:id/run')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Chạy engine → material_calculation + trace + supply_required (tái lập theo hash)' })
  run(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.run(id, user);
  }

  @Post('calculation-scenarios/:id/lock')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Khóa kịch bản (LOCKED bất biến) & bàn giao DT-09' })
  lock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.lockScenario(id, user);
  }

  // ---- Lần chạy (static /runs/compare TRƯỚC route động /runs/:id) ----
  @Get('runs/compare')
  @ApiOperation({ summary: 'So sánh 2 lần chạy → ΔNC theo vật chất (SCR-DT08-06)' })
  compare(@Query('base') base: string, @Query('target') target: string, @CurrentUser() user: AuthUser) {
    return this.service.compare(base, target, user);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.service.getRun(id);
  }

  @Get('runs/:id/materials')
  @ApiOperation({ summary: 'Bảng kết quả NC (TT_GĐCB/TT_GĐCĐ/TT/PC_SSCĐ/HC/NC/supply_required)' })
  runMaterials(@Param('id') id: string) {
    return this.service.runMaterials(id);
  }

  @Get('runs/:id/materials/:mid/trace')
  @ApiOperation({ summary: 'Diễn giải 1 dòng: tới định mức + HC snapshot + PC_SSCĐ (TC-DT08-024)' })
  materialTrace(@Param('id') id: string, @Param('mid') mid: string) {
    return this.service.materialTrace(id, mid);
  }

  @Get('runs/:id/supply-required')
  @ApiOperation({ summary: 'Cấp supply_required cho DT-09' })
  supplyRequired(@Param('id') id: string) {
    return this.service.supplyRequired(id);
  }

  @Get('runs/:id/exceptions')
  @ApiOperation({ summary: 'Hàng chờ ngoại lệ: NO_RULE/CONFLICT/NO_HC_SNAPSHOT (SCR-DT08-05)' })
  exceptions(@Param('id') id: string) {
    return this.service.exceptions(id);
  }
}
