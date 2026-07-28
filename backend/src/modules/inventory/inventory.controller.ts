import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import {
  AdjustmentDto,
  CreateStorageLocationDto,
  CreateTransactionDto,
  InventoryFilterQuery,
} from './dto/inventory.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
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
  @ApiOperation({ summary: 'Danh sách kho/địa điểm lưu giữ' })
  listLocations(@Query() q: PaginationQuery) {
    return this.service.listLocations(q);
  }

  @Post('storage-locations')
  @Roles(Role.BARRACKS_OFFICER, Role.COMMUNE_USER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Tạo kho/địa điểm lưu giữ' })
  createLocation(@Body() dto: CreateStorageLocationDto, @CurrentUser() user: AuthUser) {
    return this.service.createLocation(dto, user);
  }

  @Get('balances')
  @ApiOperation({ summary: 'UC-08: Số dư tồn (kèm chênh lệch kiểm kê)' })
  balances(@Query() q: InventoryFilterQuery) {
    return this.service.listBalances(q, { storageLocationId: q.storageLocationId, materialId: q.materialId });
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
