import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaterialDeclarationService } from './material-declaration.service';
import {
  CreateAmendmentDto,
  CreateDeclarationDto,
  CreateLineDto,
  ReviewDecisionDto,
  UpdateDeclarationDto,
  UpdateLineDto,
} from './dto/material-declaration.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { Scoped } from '../../common/scope/scope.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// Khai báo vật chất — cấp xã & đơn vị trực thuộc Tỉnh nhập; cấp trên duyệt.
const DECLARERS = [
  Role.SYS_ADMIN,
  Role.PROVINCIAL_COMMAND,
  Role.BARRACKS_OFFICER,
  Role.COMMUNE_USER,
  Role.UNIT_USER,
];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.REVIEWER];

@ApiTags('Khai báo vật chất (xã/đơn vị)')
@ApiBearerAuth()
@Controller('material-declarations')
export class MaterialDeclarationController {
  constructor(private readonly service: MaterialDeclarationService) {}

  // ---- Đề nghị sửa (đặt trước :id để tránh nhầm route) ----
  @Post('amendment-requests/:rid/submit')
  @Roles(...DECLARERS)
  submitAmendment(@Param('rid', ParseUUIDPipe) rid: string, @CurrentUser() user: AuthUser) {
    return this.service.submitAmendment(rid, user);
  }

  @Post('amendment-requests/:rid/approve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Duyệt đề nghị → mở khóa bản khai báo về CHANGES_REQUESTED' })
  approveAmendment(@Param('rid', ParseUUIDPipe) rid: string, @CurrentUser() user: AuthUser) {
    return this.service.approveAmendment(rid, user);
  }

  @Post('amendment-requests/:rid/reject')
  @Roles(...APPROVERS)
  rejectAmendment(
    @Param('rid', ParseUUIDPipe) rid: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.rejectAmendment(rid, dto, user);
  }

  // ---- Dòng vật chất ----
  @Put('lines/:lineId')
  @Roles(...DECLARERS)
  updateLine(
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateLine(lineId, dto, user);
  }

  @Delete('lines/:lineId')
  @Roles(...DECLARERS)
  deleteLine(@Param('lineId', ParseUUIDPipe) lineId: string, @CurrentUser() user: AuthUser) {
    return this.service.deleteLine(lineId, user);
  }

  // ---- Bản khai báo ----
  @Get()
  @ApiOperation({ summary: 'Danh sách bản khai báo (lọc theo phạm vi đơn vị)' })
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user);
  }

  @Post()
  @Roles(...DECLARERS)
  @Scoped('organization')
  @ApiOperation({ summary: 'Tạo bản khai báo (DRAFT)' })
  create(@Body() dto: CreateDeclarationDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user);
  }

  @Put(':id')
  @Roles(...DECLARERS)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeclarationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...DECLARERS)
  @ApiOperation({ summary: 'Xóa bản khai báo (chỉ khi DRAFT)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Get(':id/revisions')
  revisions(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.listRevisions(id, user);
  }

  @Post(':id/lines')
  @Roles(...DECLARERS)
  addLine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLineDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addLine(id, dto, user);
  }

  @Post(':id/submit')
  @Roles(...DECLARERS)
  @ApiOperation({ summary: 'Gửi duyệt (DRAFT/CHANGES_REQUESTED → PENDING_REVIEW)' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Duyệt (→APPROVED, khóa). Người lập không tự duyệt.' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/request-changes')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Yêu cầu bổ sung (→CHANGES_REQUESTED)' })
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestChanges(id, dto, user);
  }

  // ---- Đề nghị sửa (theo bản khai báo) ----
  @Get(':id/amendment-requests')
  listAmendments(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.listAmendments(id, user);
  }

  @Post(':id/amendment-requests')
  @Roles(...DECLARERS)
  @ApiOperation({ summary: 'Đề nghị sửa bản đã DUYỆT (nội dung sửa, lý do, minh chứng)' })
  createAmendment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAmendmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createAmendment(id, dto, user);
  }
}
