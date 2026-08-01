import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReadinessMaterialsService } from './readiness-materials.service';
import {
  CopyFromPreviousDto,
  CreateReadinessMaterialPlanDto,
  ListReadinessMaterialsQuery,
  ReadinessReviewDto,
  SaveLinesDto,
  UpdateReadinessMaterialPlanDto,
} from './dto/readiness-material.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// Trục B — Khai báo vật chất SSCĐ theo 4 mức (Thường xuyên→Tăng cường→Cao→Toàn bộ).
// Xã khai báo/copy-forward/gửi duyệt; chỉ huy xã (REVIEWER/…) duyệt. Lọc theo data-scope.
@ApiTags('Readiness Materials (SSCĐ – Trục B)')
@ApiBearerAuth()
@Controller('readiness-materials')
export class ReadinessMaterialsController {
  constructor(private readonly service: ReadinessMaterialsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bản khai báo vật chất SSCĐ (lọc xã/mức/trạng thái, theo phạm vi)' })
  list(@Query() q: ListReadinessMaterialsQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, user);
  }

  @Post()
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Xã tạo bản khai báo SSCĐ cho một mức (DRAFT)' })
  create(@Body() dto: CreateReadinessMaterialPlanDto, @CurrentUser() user: AuthUser) {
    return this.service.createPlan(dto, user);
  }

  @Post('copy-from-previous')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Sao chép từ mức liền dưới đã duyệt sang mức đích (copy-forward)' })
  copyFromPrevious(@Body() dto: CopyFromPreviousDto, @CurrentUser() user: AuthUser) {
    return this.service.copyFromPreviousState(dto, user);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Lịch sử phiên bản bản khai báo SSCĐ' })
  revisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listRevisions(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bản khai báo SSCĐ (kèm dòng vật chất)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Put(':id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Cập nhật ghi chú bản (chưa chốt)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReadinessMaterialPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updatePlan(id, dto, user);
  }

  @Put(':id/lines')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Lưu toàn bộ dòng vật chất của bản (thay thế; chưa chốt)' })
  saveLines(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveLinesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.saveLines(id, dto, user);
  }

  @Post(':id/submit')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Gửi bản khai báo SSCĐ vào luồng duyệt' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Chỉ huy xã duyệt bản khai báo SSCĐ (người lập không tự duyệt)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/request-changes')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Yêu cầu bổ sung bản khai báo SSCĐ' })
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReadinessReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestChanges(id, dto, user);
  }
}
