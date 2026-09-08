import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Dt12Service } from './dt12.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Scoped } from '../../common/scope/scope.decorator';
import { Role } from '../identity/roles';
import {
  AckAlertDto,
  AddCriterionDto,
  AddOptionDto,
  AssignAlertDto,
  ComputeMetricDto,
  CreateAlertRuleDto,
  CreateDecisionSessionDto,
  CreateFormulaVersionDto,
  CreateKpiDefinitionDto,
  CreateThresholdDto,
  DataMartRefreshDto,
  EvaluateAlertsDto,
  RecordDecisionDto,
  ResolveAlertDto,
  ScoreDto,
} from './dto/dt12.dto';

// DT-12 — Dashboard chỉ huy & hỗ trợ quyết định (Quyển XII §XV). Prefix /api/v1/dt12/...
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const COMMAND = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-12 Dashboard chỉ huy')
@ApiBearerAuth()
@Controller('dt12')
export class Dt12Controller {
  constructor(private readonly service: Dt12Service) {}

  // ---- kpi_definition / formula_version / threshold ----
  @Get('kpi-definitions')
  @ApiOperation({ summary: 'SCR-DT12-04: Danh mục KPI (semantic-ref, cấu hình)' })
  listKpis() {
    return this.service.listKpis();
  }

  @Post('kpi-definitions')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Thêm KPI bằng cấu hình (semantic-ref; không tạo số Dashboard độc lập — AC-15)' })
  createKpi(@Body() dto: CreateKpiDefinitionDto, @CurrentUser() user: AuthUser) {
    return this.service.createKpi(dto, user);
  }

  @Get('kpi-definitions/:id')
  getKpi(@Param('id') id: string) {
    return this.service.getKpi(id);
  }

  @Get('kpi-definitions/:id/formula-versions')
  listFormulas(@Param('id') id: string) {
    return this.service.listFormulaVersions(id);
  }
  @Post('kpi-definitions/:id/formula-versions')
  @Roles(...WRITERS)
  addFormula(@Param('id') id: string, @Body() dto: CreateFormulaVersionDto, @CurrentUser() user: AuthUser) {
    return this.service.addFormulaVersion(id, dto, user);
  }

  @Get('kpi-definitions/:id/thresholds')
  listThresholds(@Param('id') id: string) {
    return this.service.listThresholds(id);
  }
  @Post('kpi-definitions/:id/thresholds')
  @Roles(...WRITERS)
  addThreshold(@Param('id') id: string, @Body() dto: CreateThresholdDto, @CurrentUser() user: AuthUser) {
    return this.service.addThreshold(id, dto, user);
  }

  // ---- metric_instance ----
  @Post('metrics/compute')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT12-01: Tính metric KPI (as_of_time + lineage + freshness)' })
  computeMetric(@Body() dto: ComputeMetricDto, @CurrentUser() user: AuthUser) {
    return this.service.computeMetric(dto, user);
  }

  @Get('metrics')
  @ApiQuery({ name: 'kpi', required: false })
  @ApiQuery({ name: 'as_of', required: false })
  listMetrics(@Query('kpi') kpi?: string, @Query('as_of') asOf?: string) {
    return this.service.listMetrics({ kpiCode: kpi, asOf });
  }

  @Get('metrics/:id/lineage')
  @ApiOperation({ summary: 'SCR-DT12-03: Truy vết KPI → nguồn (BR AC-15)' })
  metricLineage(@Param('id') id: string) {
    return this.service.getMetricLineage(id);
  }

  @Get('metrics/:id/drill-down')
  @ApiOperation({ summary: 'SCR-DT12-03: Drill-down KPI → dòng snapshot nguồn (khớp tổng — TC-001)' })
  metricDrillDown(@Param('id') id: string) {
    return this.service.getMetricDrillDown(id);
  }

  // ---- semantic explorer ----
  @Get('semantics')
  @Scoped('organization')
  @ApiOperation({ summary: 'SCR-DT12-04: Semantic explorer HC/HC-AVAILABLE/RESERVE-SSCD/PC-SCD/NC/SUPPLY/GAP' })
  semantics(@CurrentUser() user: AuthUser, @Query('scope') scope?: string) {
    return this.service.semantics(user, scope ? JSON.parse(scope) : undefined);
  }

  // ---- data mart ----
  @Post('data-mart/refresh')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT12-08: Refresh Data Mart (dẫn xuất, qua outbox — không sửa tay)' })
  refreshDataMart(@Body() dto: DataMartRefreshDto, @CurrentUser() user: AuthUser) {
    return this.service.refreshDataMart(dto, user);
  }

  @Get('data-mart/freshness')
  @ApiOperation({ summary: 'SCR-DT12-08: Độ tươi dữ liệu & nguồn (STALE khi nguồn mới hơn)' })
  dataMartFreshness() {
    return this.service.dataMartFreshness();
  }

  // ---- alert_rule / alert_instance ----
  @Get('alert-rules')
  listAlertRules() {
    return this.service.listAlertRules();
  }
  @Post('alert-rules')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT12-05: Cấu hình quy tắc cảnh báo (ngưỡng + severity + SLA)' })
  createAlertRule(@Body() dto: CreateAlertRuleDto, @CurrentUser() user: AuthUser) {
    return this.service.createAlertRule(dto, user);
  }

  @Post('alerts/evaluate')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT12-05: Quét KPI vs ngưỡng → sinh cảnh báo (severity + SLA)' })
  evaluateAlerts(@Body() dto: EvaluateAlertsDto, @CurrentUser() user: AuthUser) {
    return this.service.evaluateAlerts(dto, user);
  }

  @Get('alerts')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'severity', required: false })
  listAlerts(@Query('status') status?: string, @Query('severity') severity?: string) {
    return this.service.listAlerts({ status, severity });
  }

  @Post('alerts/:id/ack')
  @ApiOperation({ summary: 'SCR-DT12-05: Tiếp nhận cảnh báo (OPEN → ACK)' })
  ackAlert(@Param('id') id: string, @Body() dto: AckAlertDto, @CurrentUser() user: AuthUser) {
    return this.service.ackAlert(id, dto, user);
  }

  @Post('alerts/:id/resolve')
  @ApiOperation({ summary: 'SCR-DT12-05: Đóng cảnh báo (→ RESOLVED, bất biến)' })
  resolveAlert(@Param('id') id: string, @Body() dto: ResolveAlertDto, @CurrentUser() user: AuthUser) {
    return this.service.resolveAlert(id, dto, user);
  }

  @Post('alerts/:id/assign')
  @Roles(...COMMAND)
  @ApiOperation({ summary: 'SCR-DT12-05: Giao việc xử lý cảnh báo' })
  assignAlert(@Param('id') id: string, @Body() dto: AssignAlertDto, @CurrentUser() user: AuthUser) {
    return this.service.assignAlert(id, dto, user);
  }

  // ---- decision (what-if cách ly) ----
  @Post('decision-sessions')
  @Roles(...COMMAND)
  @ApiOperation({ summary: 'SCR-DT12-06/07: Mở phiên what-if (chụp baseline, cách ly)' })
  createSession(@Body() dto: CreateDecisionSessionDto, @CurrentUser() user: AuthUser) {
    return this.service.createSession(dto, user);
  }

  @Get('decision-sessions/:id')
  getSession(@Param('id') id: string) {
    return this.service.getSessionDetail(id);
  }

  @Post('decision-sessions/:id/options')
  @Roles(...COMMAND)
  addOption(@Param('id') id: string, @Body() dto: AddOptionDto, @CurrentUser() user: AuthUser) {
    return this.service.addOption(id, dto, user);
  }

  @Post('decision-sessions/:id/criteria')
  @Roles(...COMMAND)
  addCriterion(@Param('id') id: string, @Body() dto: AddCriterionDto, @CurrentUser() user: AuthUser) {
    return this.service.addCriterion(id, dto, user);
  }

  @Post('decision-sessions/:id/score')
  @Roles(...COMMAND)
  @ApiOperation({ summary: 'SCR-DT12-07: Chấm điểm phương án × tiêu chí (chuẩn hóa + trọng số)' })
  score(@Param('id') id: string, @Body() dto: ScoreDto, @CurrentUser() user: AuthUser) {
    return this.service.score(id, dto, user);
  }

  @Post('decision-sessions/:id/record')
  @Roles(...COMMAND)
  @ApiOperation({ summary: 'SCR-DT12-07: Ghi quyết định (chọn phương án + lý do)' })
  record(@Param('id') id: string, @Body() dto: RecordDecisionDto, @CurrentUser() user: AuthUser) {
    return this.service.recordDecision(id, dto, user);
  }

  // ---- command overview & map ----
  @Get('command-overview')
  @Scoped('organization')
  @ApiOperation({ summary: 'SCR-DT12-01: Tổng quan chỉ huy (KPI semantic + freshness, mọi KPI có lineage)' })
  commandOverview(@CurrentUser() user: AuthUser, @Query('scope') scope?: string) {
    return this.service.commandOverview(user, scope ? JSON.parse(scope) : undefined);
  }

  @Get('map/materials')
  @Scoped('organization')
  @ApiOperation({ summary: 'SCR-DT12-02: Bản đồ vật chất theo phân quyền vị trí (data-scope — TC-010)' })
  mapMaterials(@CurrentUser() user: AuthUser) {
    return this.service.mapMaterials(user);
  }
}
