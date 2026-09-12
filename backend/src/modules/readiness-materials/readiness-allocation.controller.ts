import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReadinessAllocationService } from './readiness-allocation.service';
import {
  AllocationReviewDto,
  CreateAllocationPlanDto,
  ListAllocationQuery,
  SaveAllocationLinesDto,
  UpdateAllocationPlanDto,
} from './dto/readiness-allocation.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// Feature 03 — Phương án PHÂN CẤP LƯỢNG vật chất SSCĐ do Cơ quan HC-KT Tỉnh xây dựng (top-down).
// Chỉ cấp Tỉnh tạo/sửa; 3 bảng riêng theo trạng thái (Tăng cường/Cao/Toàn bộ).
const PLANNERS = [Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN];
const APPROVERS = [Role.REVIEWER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN];

@ApiTags('Readiness Allocation (SSCĐ – Phương án cấp Tỉnh)')
@ApiBearerAuth()
@Controller('readiness-allocations')
export class ReadinessAllocationController {
  constructor(private readonly service: ReadinessAllocationService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách phương án SSCĐ (lọc theo trạng thái/workflow)' })
  list(@Query() q: ListAllocationQuery) {
    return this.service.list(q);
  }

  @Post()
  @Roles(...PLANNERS)
  @ApiOperation({ summary: 'Cấp Tỉnh tạo phương án phân cấp lượng SSCĐ (DRAFT)' })
  create(@Body() dto: CreateAllocationPlanDto, @CurrentUser() user: AuthUser) {
    return this.service.createPlan(dto, user);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Lịch sử phiên bản phương án' })
  revisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listRevisions(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết phương án (kèm dòng phân cấp lượng theo cấp)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Put(':id')
  @Roles(...PLANNERS)
  @ApiOperation({ summary: 'Cập nhật thông tin phương án (chưa chốt)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAllocationPlanDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updatePlan(id, dto, user);
  }

  @Put(':id/lines')
  @Roles(...PLANNERS)
  @ApiOperation({ summary: 'Lưu toàn bộ dòng phân cấp lượng (thay thế; chưa chốt)' })
  saveLines(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAllocationLinesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.saveLines(id, dto, user);
  }

  @Post(':id/submit')
  @Roles(...PLANNERS)
  @ApiOperation({ summary: 'Gửi phương án vào luồng duyệt' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Duyệt phương án (người lập không tự duyệt)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/request-changes')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Yêu cầu bổ sung phương án' })
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: AllocationReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestChanges(id, user);
  }
}
