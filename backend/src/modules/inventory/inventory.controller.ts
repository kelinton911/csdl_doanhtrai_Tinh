import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  AdjustmentDto,
  CreateStorageLocationDto,
  CreateTransactionDto,
  InventoryFilterQuery,
  InventorySummaryQuery,
  ListStorageLocationsQuery,
  StorageReviewDto,
  UpdateStorageLocationDto,
} from './dto/inventory.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// M06 — Inventory (UC-08). Idempotency-Key áp dụng cho các POST phát sinh tồn.
@ApiTags('Inventory (M06)')
@ApiBearerAuth()
@ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Chống trùng giao dịch' })
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('storage-locations')
  @ApiOperation({ summary: 'Danh sách kho (lọc theo phạm vi dữ liệu, tìm kiếm, trạng thái)' })
  listLocations(@Query() q: ListStorageLocationsQuery, @CurrentUser() user: AuthUser) {
    return this.service.listLocations(q, user);
  }

  @Post('storage-locations')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Xã khai báo kho (DRAFT)' })
  createLocation(@Body() dto: CreateStorageLocationDto, @CurrentUser() user: AuthUser) {
    return this.service.createLocation(dto, user);
  }

  @Get('storage-locations/:id/revisions')
  @ApiOperation({ summary: 'Lịch sử phiên bản hồ sơ kho' })
  locationRevisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listLocationRevisions(id);
  }

  @Get('storage-locations/:id')
  @ApiOperation({ summary: 'Chi tiết kho' })
  getLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getLocation(id);
  }

  @Put('storage-locations/:id')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Cập nhật hồ sơ kho (chưa chốt)' })
  updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStorageLocationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateLocation(id, dto, user);
  }

  @Post('storage-locations/:id/submit')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Gửi hồ sơ kho vào luồng kiểm duyệt' })
  submitLocation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submitLocation(id, user);
  }

  @Post('storage-locations/:id/approve')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Chỉ huy xã duyệt hồ sơ kho (người lập không tự duyệt)' })
  approveLocation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveLocation(id, user);
  }

  @Post('storage-locations/:id/request-changes')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Yêu cầu bổ sung hồ sơ kho' })
  requestLocationChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StorageReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestLocationChanges(id, dto, user);
  }

  @Get('balances')
  @ApiOperation({ summary: 'UC-08: Số dư tồn (kèm chênh lệch kiểm kê, lọc theo phạm vi dữ liệu)' })
  balances(@Query() q: InventoryFilterQuery, @CurrentUser() user: AuthUser) {
    return this.service.listBalances(
      q,
      { storageLocationId: q.storageLocationId, materialId: q.materialId, areaId: q.areaId },
      user,
    );
  }

  @Get('summary-by-area')
  @ApiOperation({ summary: 'Vật chất chung của xã: tổng hợp tồn theo xã (lọc 1 xã hoặc tổng toàn tỉnh)' })
  summaryByArea(@Query() q: InventorySummaryQuery, @CurrentUser() user: AuthUser) {
    return this.service.summaryByArea({ areaId: q.areaId, categoryCode: q.categoryCode }, user);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'UC-08: Sổ kho (bút toán, bất biến)' })
  listTransactions(@Query() q: InventoryFilterQuery) {
    return this.service.listTransactions(q, { storageLocationId: q.storageLocationId, materialId: q.materialId });
  }

  @Post('transactions')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-08: Ghi bút toán nhập/xuất' })
  transaction(@Body() dto: CreateTransactionDto, @CurrentUser() user: AuthUser) {
    return this.service.transaction(dto, user);
  }

  @Post('adjustments')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-08: Điều chỉnh kiểm kê (ghi chênh lệch)' })
  adjustment(@Body() dto: AdjustmentDto, @CurrentUser() user: AuthUser) {
    return this.service.adjustment(dto, user);
  }
}
