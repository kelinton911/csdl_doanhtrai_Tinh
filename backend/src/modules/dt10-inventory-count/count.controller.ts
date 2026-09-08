import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CountService } from './count.service';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import {
  BuildDatasetDto,
  CampaignQuery,
  CreateAdjustmentDto,
  CreateCampaignDto,
  CreateSheetDto,
  CutoffDto,
  QualityGradesDto,
  RecountDto,
  ResolveVarianceDto,
  ReviseDto,
  UnlockDto,
  UpdateSheetLinesDto,
} from './dto/dt10.dto';

// DT-10 — Kiểm kê & chốt số liệu (Quyển X §XVI).
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-10 Kiểm kê & chốt số liệu')
@ApiBearerAuth()
@Controller()
export class CountController {
  constructor(private readonly service: CountService) {}

  // ---- Đợt kiểm kê ----
  @Get('count-campaigns')
  list(@Query() q: CampaignQuery) {
    return this.service.listCampaigns(q);
  }

  @Post('count-campaigns')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Lập đợt kiểm kê (loại đợt + phạm vi)' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthUser) {
    return this.service.createCampaign(dto, user);
  }

  @Get('count-campaigns/:id')
  get(@Param('id') id: string) {
    return this.service.getCampaign(id);
  }

  @Post('count-campaigns/:id/cutoff')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Chốt cutoff (mốc dựng book_snapshot bất biến)' })
  cutoff(@Param('id') id: string, @Body() dto: CutoffDto, @CurrentUser() user: AuthUser) {
    return this.service.cutoff(id, dto, user);
  }

  @Post('count-campaigns/:id/build-book-snapshot')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Dựng book_snapshot từ sổ cái DT-04 tại cutoff (checksum, bất biến)' })
  buildBook(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.buildBookSnapshot(id, user);
  }

  @Get('count-campaigns/:id/book-snapshot')
  bookSnapshot(@Param('id') id: string) {
    return this.service.getBookSnapshot(id);
  }

  // ---- Phiếu kiểm đếm (blind) ----
  @Post('count-campaigns/:id/sheets')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Tạo phiếu kiểm đếm (blind — không hiển thị số sổ)' })
  createSheet(@Param('id') id: string, @Body() dto: CreateSheetDto, @CurrentUser() user: AuthUser) {
    return this.service.createSheet(id, dto, user);
  }

  @Get('count-campaigns/:id/sheets')
  listSheets(@Param('id') id: string) {
    return this.service.listSheets(id);
  }

  @Get('count-sheets/:id')
  sheetDetail(@Param('id') id: string) {
    return this.service.getSheetDetail(id);
  }

  @Put('count-sheets/:id/lines')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Autosave dòng kiểm đếm vòng hiện tại (giữ nguyên vòng trước)' })
  updateLines(@Param('id') id: string, @Body() dto: UpdateSheetLinesDto, @CurrentUser() user: AuthUser) {
    return this.service.updateSheetLines(id, dto, user);
  }

  @Post('count-sheets/:id/submit')
  @Roles(...WRITERS)
  submitSheet(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.submitSheet(id, user);
  }

  @Post('count-sheets/:id/approve')
  @Roles(...APPROVERS)
  approveSheet(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveSheet(id, user);
  }

  @Post('count-sheets/:id/recount')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Kiểm đếm lại — vòng MỚI (không ghi đè vòng trước)' })
  recount(@Param('id') id: string, @Body() dto: RecountDto, @CurrentUser() user: AuthUser) {
    return this.service.recount(id, dto, user);
  }

  // ---- Kiểm kê chất lượng C1–5 ----
  @Post('count-lines/:id/quality')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Kiểm kê chất lượng C1–5 (Σ = số thực đếm; lệch → QUALITY_TOTAL_MISMATCH)' })
  quality(@Param('id') id: string, @Body() dto: QualityGradesDto, @CurrentUser() user: AuthUser) {
    return this.service.saveQualityGrades(id, dto, user);
  }

  // ---- Đối chiếu lệch (variance) ----
  @Post('count-campaigns/:id/variances')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Đối chiếu Book ↔ Physical → sinh chênh lệch đủ loại' })
  computeVariances(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.computeVariances(id, user);
  }

  @Get('count-campaigns/:id/variances')
  listVariances(@Param('id') id: string) {
    return this.service.listVariances(id);
  }

  @Post('variances/:id/resolve')
  @Roles(...WRITERS)
  resolveVariance(@Param('id') id: string, @Body() dto: ResolveVarianceDto, @CurrentUser() user: AuthUser) {
    return this.service.resolveVariance(id, dto, user);
  }

  // ---- Chốt số chính thức + khóa (official) ----
  @Post('count-campaigns/:id/official-snapshot')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Chốt official_snapshot (version + checksum)' })
  createOfficial(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.createOfficialSnapshot(id, user);
  }

  @Get('count-campaigns/:id/official-snapshot')
  getOfficial(@Param('id') id: string) {
    return this.service.getOfficialSnapshot(id);
  }

  @Post('count-campaigns/:id/lock')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Khóa official_snapshot (bất biến)' })
  lock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.lockOfficial(id, user);
  }

  @Post('count-campaigns/:id/unlock')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Mở khóa (bắt buộc lý do) để revise' })
  unlock(@Param('id') id: string, @Body() dto: UnlockDto, @CurrentUser() user: AuthUser) {
    return this.service.unlockOfficial(id, dto, user);
  }

  @Post('count-campaigns/:id/revise')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Tạo revision official_snapshot (version mới) sau khi mở khóa' })
  revise(@Param('id') id: string, @Body() dto: ReviseDto, @CurrentUser() user: AuthUser) {
    return this.service.reviseOfficial(id, dto, user);
  }

  // ---- Điều chỉnh → DT-05 ----
  @Post('count-campaigns/:id/adjustment-requests')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Lập yêu cầu điều chỉnh từ chênh lệch (→ DT-05, không sửa số dư trực tiếp)' })
  createAdjustment(@Param('id') id: string, @Body() dto: CreateAdjustmentDto, @CurrentUser() user: AuthUser) {
    return this.service.createAdjustmentRequest(id, dto, user);
  }

  @Get('count-campaigns/:id/adjustment-requests')
  listAdjustments(@Param('id') id: string) {
    return this.service.listAdjustments(id);
  }

  @Post('adjustment-requests/:id/approve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Duyệt điều chỉnh → sinh chứng từ DT-05 (CONVERSION) và POST' })
  approveAdjustment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveAdjustment(id, user);
  }

  // ---- Reconciliation & dataset (→ DT-11) ----
  @Get('count-campaigns/:id/reconciliation')
  reconciliation(@Param('id') id: string) {
    return this.service.reconciliation(id);
  }

  @Get('count-campaigns/:id/datasets')
  listDatasets(@Param('id') id: string) {
    return this.service.listDatasets(id);
  }

  @Post('count-campaigns/:id/datasets')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Sinh dataset biểu KK gắn snapshot_version (cấp DT-11)' })
  buildDataset(@Param('id') id: string, @Body() dto: BuildDatasetDto, @CurrentUser() user: AuthUser) {
    return this.service.buildDataset(id, dto, user);
  }
}
