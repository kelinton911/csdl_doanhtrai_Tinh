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
import { InspectionService } from './inspection.service';
import {
  CreateCampaignDto,
  CreateSheetDto,
  ListSheetsQuery,
  ReviewDecisionDto,
  ReviewQueueQuery,
  UpdateSheetDto,
} from './dto/inspection.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// M07 — Inspection & Review. UC-09/10/11.
@ApiTags('Inspection & Review (M07)')
@ApiBearerAuth()
@Controller()
export class InspectionController {
  constructor(private readonly service: InspectionService) {}

  // ------- Đợt kiểm kê -------
  @Get('inspection-campaigns')
  @ApiOperation({ summary: 'UC-09: Danh sách đợt kiểm kê' })
  listCampaigns(@Query() q: PaginationQuery) {
    return this.service.listCampaigns(q);
  }

  @Post('inspection-campaigns')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-09: Tạo đợt kiểm kê' })
  createCampaign(@Body() dto: CreateCampaignDto, @CurrentUser() user: AuthUser) {
    return this.service.createCampaign(dto, user);
  }

  @Post('inspection-campaigns/:id/open')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-09: Phát hành đợt kiểm kê' })
  openCampaign(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.openCampaign(id, user);
  }

  @Post('inspection-campaigns/:id/close')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-09: Đóng đợt kiểm kê' })
  closeCampaign(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.closeCampaign(id, user);
  }

  @Get('inspection-campaigns/:id/progress')
  @ApiOperation({ summary: 'UC-09: Tiến độ đợt kiểm kê' })
  progress(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.campaignProgress(id);
  }

  // ------- Phiếu kiểm kê -------
  @Get('inspection-sheets')
  @ApiOperation({ summary: 'UC-10: Danh sách phiếu kiểm kê' })
  listSheets(@Query() q: ListSheetsQuery) {
    return this.service.listSheets(q, q.campaignId);
  }

  @Get('inspection-sheets/:id')
  @ApiOperation({ summary: 'UC-10: Chi tiết phiếu (kèm dòng + chênh lệch)' })
  getSheet(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getSheet(id);
  }

  @Post('inspection-sheets')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-10: Mở phiếu kiểm kê' })
  createSheet(@Body() dto: CreateSheetDto, @CurrentUser() user: AuthUser) {
    return this.service.createSheet(dto, user);
  }

  @Put('inspection-sheets/:id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-10: Lưu nháp (autosave dòng số liệu)' })
  updateSheet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSheetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateSheet(id, dto, user);
  }

  @Post('inspection-sheets/:id/submit')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-10: Gửi phiếu vào kiểm duyệt' })
  submitSheet(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submitSheet(id, user);
  }

  // ------- Kiểm duyệt -------
  @Get('review-tasks')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-11: Hàng đợi kiểm duyệt' })
  listTasks(@Query() q: ReviewQueueQuery) {
    return this.service.listReviewTasks(q, q.status ?? 'PENDING');
  }

  @Get('review-tasks/:id')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-11: Chi tiết nhiệm vụ (kèm phiếu để so sánh)' })
  getTask(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getReviewTask(id);
  }

  @Post('review-tasks/:id/approve')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-11: Phê duyệt (người lập không tự duyệt)' })
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.approveTask(id, dto, user);
  }

  @Post('review-tasks/:id/request-revision')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-11: Yêu cầu bổ sung' })
  requestRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestRevision(id, dto, user);
  }
}
