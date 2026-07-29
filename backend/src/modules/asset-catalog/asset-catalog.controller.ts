import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AssetCatalogService } from './asset-catalog.service';
import { AssetClassifyService, SetAssetCodeInput } from './asset-classify.service';
import {
  AssetGapsQuery,
  AssetSearchQuery,
  AssetSubtreeQuery,
  AssetTreeQuery,
} from './dto/asset-catalog.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';

// TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI — Phụ lục kèm CV 2837/DT-QLDT ngày 16/7/2026.
// Dữ liệu do BQP sở hữu: CHỈ ĐỌC. Không có route tạo/sửa/xoá nút danh mục —
// mọi thay đổi phải qua `npm run seed:asset-catalog` với file phụ lục đã chốt hash.
@ApiTags('Danh mục tài sản ngành Doanh trại')
@ApiBearerAuth()
@Controller('asset-catalog')
export class AssetCatalogController {
  constructor(
    private readonly service: AssetCatalogService,
    private readonly classify: AssetClassifyService,
  ) {}

  @Get('meta')
  @ApiOperation({
    summary: 'Thông tin bản phụ lục đang nạp + số liệu tự kiểm chứng toàn vẹn',
  })
  getMeta() {
    return this.service.getMeta();
  }

  @Get('tree')
  @ApiOperation({ summary: 'Con trực tiếp của một nút (bỏ trống parent = nút gốc)' })
  getTree(@Query() q: AssetTreeQuery) {
    return this.service.getChildren(q.parent, q.domain, q.leafOnly);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Tìm theo tên (không dấu) hoặc mã — kết quả LUÔN kèm đường dẫn tổ tiên',
  })
  search(@Query() q: AssetSearchQuery) {
    return this.service.search({ ...q, skip: q.skip });
  }

  @Get('gaps')
  @ApiOperation({ summary: 'Vật chất/công trình chưa gắn mã quốc gia (màn rà soát)' })
  getGaps(@Query() q: AssetGapsQuery) {
    return this.service.getGaps({ ...q, skip: q.skip });
  }

  // Đặt sau các route tĩnh để không nuốt 'meta' | 'tree' | 'search' | 'gaps'.
  @Get(':code/subtree')
  @ApiOperation({ summary: 'Toàn bộ cây con của một mã (phục vụ xuất và tổng hợp)' })
  getSubtree(@Param('code') code: string, @Query() q: AssetSubtreeQuery) {
    return this.service.getSubtree(code, { ...q, skip: q.skip });
  }

  @Get(':code')
  @ApiOperation({ summary: 'Chi tiết một mã + tổ tiên (breadcrumb) + con trực tiếp' })
  getByCode(@Param('code') code: string) {
    return this.service.getByCode(code);
  }

  // ---- Gắn mã quốc gia cho dữ liệu cục bộ ----
  // KHÔNG đi qua MasterDataService.updateMaterial: hàm đó chặn WF-001 với hàng đã
  // PUBLISHED, mà toàn bộ danh mục chính thức đều PUBLISHED. Xem asset-classify.service.ts.
  @Patch('materials/:id/asset-code')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Gắn/gỡ mã quốc gia cho vật chất (kể cả hàng đã phát hành)' })
  setMaterialAssetCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetAssetCodeInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.classify.setMaterialAssetCode(id, body, user);
  }

  @Patch('facilities/:id/asset-code')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Gắn/gỡ mã quốc gia cho công trình' })
  setFacilityAssetCode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetAssetCodeInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.classify.setFacilityAssetCode(id, body, user);
  }
}
