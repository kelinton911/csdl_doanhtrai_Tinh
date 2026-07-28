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
import { ScenarioService } from './scenario.service';
import {
  ComparePlansDto,
  CreatePlanDto,
  CreateScenarioDto,
} from './dto/scenario.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// M10 — Scenario & Planning. UC-15/16.
@ApiTags('Scenario & Planning (M10)')
@ApiBearerAuth()
@Controller()
export class ScenarioController {
  constructor(private readonly service: ScenarioService) {}

  @Get('scenarios')
  @ApiOperation({ summary: 'UC-15: Danh sách tình huống' })
  listScenarios(@Query() q: PaginationQuery) {
    return this.service.listScenarios(q);
  }

  @Get('scenarios/:id')
  @ApiOperation({ summary: 'UC-15: Chi tiết tình huống' })
  getScenario(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getScenario(id);
  }

  @Post('scenarios')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-15: Tạo tình huống' })
  createScenario(@Body() dto: CreateScenarioDto, @CurrentUser() user: AuthUser) {
    return this.service.createScenario(dto, user);
  }

  @Post('scenarios/:id/runs')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-15: Chạy engine tính toán khả năng bảo đảm' })
  run(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.run(id, user);
  }

  @Get('scenarios/:id/runs')
  @ApiOperation({ summary: 'UC-15: Lịch sử lần chạy' })
  listRuns(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listRuns(id);
  }

  @Get('scenario-runs/:id')
  @ApiOperation({ summary: 'UC-15: Kết quả một lần chạy' })
  getRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getRun(id);
  }

  @Get('plans')
  @ApiOperation({ summary: 'UC-16: Danh sách phương án' })
  listPlans(@Query() q: PaginationQuery) {
    return this.service.listPlans(q);
  }

  @Post('plans')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-16: Tạo phương án từ kết quả tính toán' })
  createPlan(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    return this.service.createPlan(dto, user);
  }

  @Post('plans/compare')
  @ApiOperation({ summary: 'UC-16: So sánh nhiều phương án' })
  compare(@Body() dto: ComparePlansDto) {
    return this.service.comparePlans(dto);
  }

  @Post('plans/:id/approve')
  @Roles(Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-16: Chốt phương án (bất biến; sửa phải tạo bản thay thế)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approvePlan(id, user);
  }
}
