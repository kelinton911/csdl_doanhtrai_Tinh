import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import {
  AddFieldDto,
  AddFilterDto,
  AddFormulaDto,
  CreateDatasetDefinitionDto,
  CreateReportDefinitionDto,
  CreateReportInstanceDto,
  CreateTemplateVersionDto,
  GenerateDatasetDto,
  IssueReportDto,
  RollupDto,
} from './dto/dt11.dto';

// DT-11 — Báo cáo & biểu mẫu (Quyển XI §XVI). Prefix toàn cục /api/v1.
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-11 Báo cáo & biểu mẫu')
@ApiBearerAuth()
@Controller()
export class ReportController {
  constructor(private readonly service: ReportService) {}

  // ---- report_definition / template_version ----
  @Get('report-definitions')
  @ApiOperation({ summary: 'SCR-DT11-01: Danh mục biểu (cấu hình)' })
  listDefinitions() {
    return this.service.listDefinitions();
  }

  @Post('report-definitions')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Thêm biểu mới bằng cấu hình (KHÔNG sửa code — BR-DT11-019)' })
  createDefinition(@Body() dto: CreateReportDefinitionDto, @CurrentUser() user: AuthUser) {
    return this.service.createDefinition(dto, user);
  }

  @Get('report-definitions/:id')
  getDefinition(@Param('id') id: string) {
    return this.service.getDefinition(id);
  }

  @Get('report-definitions/:id/template-versions')
  @ApiOperation({ summary: 'SCR-DT11-02: Danh sách phiên bản template/layout' })
  listTemplates(@Param('id') id: string) {
    return this.service.listTemplateVersions(id);
  }

  @Post('report-definitions/:id/template-versions')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT11-02: Thiết kế template/layout (version mới)' })
  createTemplate(@Param('id') id: string, @Body() dto: CreateTemplateVersionDto, @CurrentUser() user: AuthUser) {
    return this.service.createTemplateVersion(id, dto, user);
  }

  // ---- dataset_definition + field/filter/formula ----
  @Get('dataset-definitions')
  @ApiOperation({ summary: 'SCR-DT11-03: Danh sách dataset (nguồn snapshot chuẩn)' })
  listDatasets() {
    return this.service.listDatasetDefinitions();
  }

  @Post('dataset-definitions')
  @Roles(...WRITERS)
  createDataset(@Body() dto: CreateDatasetDefinitionDto, @CurrentUser() user: AuthUser) {
    return this.service.createDatasetDefinition(dto, user);
  }

  @Get('dataset-definitions/:id/fields')
  listFields(@Param('id') id: string) {
    return this.service.listFields(id);
  }
  @Post('dataset-definitions/:id/fields')
  @Roles(...WRITERS)
  addField(@Param('id') id: string, @Body() dto: AddFieldDto, @CurrentUser() user: AuthUser) {
    return this.service.addField(id, dto, user);
  }

  @Get('dataset-definitions/:id/filters')
  listFilters(@Param('id') id: string) {
    return this.service.listFilters(id);
  }
  @Post('dataset-definitions/:id/filters')
  @Roles(...WRITERS)
  addFilter(@Param('id') id: string, @Body() dto: AddFilterDto, @CurrentUser() user: AuthUser) {
    return this.service.addFilter(id, dto, user);
  }

  @Get('dataset-definitions/:id/formulas')
  listFormulas(@Param('id') id: string) {
    return this.service.listFormulas(id);
  }
  @Post('dataset-definitions/:id/formulas')
  @Roles(...WRITERS)
  addFormula(@Param('id') id: string, @Body() dto: AddFormulaDto, @CurrentUser() user: AuthUser) {
    return this.service.addFormula(id, dto, user);
  }

  // ---- dataset_instance ----
  @Get('dataset-instances')
  listInstances(@CurrentUser() user: AuthUser, @Query('datasetDefinitionId') defId?: string) {
    return this.service.listDatasetInstances(defId, user);
  }

  @Post('dataset-instances')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT11-04: Sinh dataset từ snapshot chuẩn (dataset_hash + source_fingerprint)' })
  generateDataset(@Body() dto: GenerateDatasetDto, @CurrentUser() user: AuthUser) {
    return this.service.generateDataset(dto, user);
  }

  @Get('dataset-instances/:id')
  getInstance(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getDatasetInstance(id, user);
  }

  @Post('dataset-instances/:id/validate')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT11-04: Validate reconciliation/quality/completeness' })
  validateDataset(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.validateDataset(id, user);
  }

  @Get('dataset-instances/:id/validations')
  listValidations(@Param('id') id: string) {
    return this.service.listDatasetValidations(id);
  }

  // ---- report_instance ----
  @Get('report-instances')
  @ApiOperation({ summary: 'SCR-DT11-09: Kho báo cáo (version)' })
  listReports(@CurrentUser() user: AuthUser) {
    return this.service.listReports(user);
  }

  @Post('report-instances')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT11-05: Lập báo cáo (chọn snapshot/dataset)' })
  createReport(@Body() dto: CreateReportInstanceDto, @CurrentUser() user: AuthUser) {
    return this.service.createReport(dto, user);
  }

  @Get('report-instances/:id')
  getReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getReport(id, user);
  }

  @Post('report-instances/:id/validate')
  @Roles(...WRITERS)
  validateReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.validateReport(id, user);
  }

  @Post('report-instances/:id/approve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'SCR-DT11-07: Duyệt (chặn nếu dataset FAIL — BR-DT11-007)' })
  approveReport(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveReport(id, user);
  }

  @Post('report-instances/:id/issue')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'SCR-DT11-07: Phát hành (file checksum bất biến — BR-DT11-016/017)' })
  issueReport(@Param('id') id: string, @Body() dto: IssueReportDto, @CurrentUser() user: AuthUser) {
    return this.service.issueReport(id, dto, user);
  }

  @Post('report-instances/:id/reissue')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'SCR-DT11-09: Phát hành lại (version mới, file cũ giữ nguyên checksum)' })
  reissueReport(@Param('id') id: string, @Body() dto: IssueReportDto, @CurrentUser() user: AuthUser) {
    return this.service.reissueReport(id, dto, user);
  }

  @Get('report-instances/:id/download')
  @ApiOperation({ summary: 'URL tải báo cáo đã phát hành (có thời hạn)' })
  download(@Param('id') id: string) {
    return this.service.downloadUrl(id);
  }

  @Post('report-instances/:id/rollup')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'SCR-DT11-06: Tổng hợp nhiều đơn vị (chống aggregate trùng)' })
  rollup(@Param('id') id: string, @Body() dto: RollupDto, @CurrentUser() user: AuthUser) {
    return this.service.rollup(id, dto, user);
  }

  @Get('report-instances/:id/rollup-status')
  @ApiOperation({ summary: 'SCR-DT11-06: Trạng thái gửi của đơn vị con (chưa gửi ≠ 0)' })
  rollupStatus(@Param('id') id: string) {
    return this.service.rollupStatus(id);
  }

  @Get('report-instances/:id/lineage')
  @ApiOperation({ summary: 'SCR-DT11-08: Truy vết ô → dataset → snapshot/giao dịch (BR-DT11-002)' })
  lineage(@Param('id') id: string, @Query('cell') cell?: string) {
    return this.service.getLineage(id, cell);
  }
}
