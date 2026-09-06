import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import {
  CompareQuery,
  CreateItemDto,
  CreateVersionDto,
  ItemQuery,
  VersionQuery,
} from './dto/catalog.dto';

// DT-01 — Danh mục chuẩn: phiên bản + cây R00 + so sánh + tìm kiếm (Quyển I §XII).
@ApiTags('DT-01 Danh mục chuẩn')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  @Get('versions')
  @ApiOperation({ summary: 'Danh sách phiên bản danh mục' })
  listVersions(@Query() q: VersionQuery) {
    return this.service.listVersions(q);
  }

  // Đặt TRƯỚC route động để 'compare' không bị bắt như tham số.
  @Get('versions/compare')
  @ApiOperation({ summary: 'So sánh 2 phiên bản (thêm/bỏ/đổi tên/đổi ĐVT/đổi cha)' })
  compare(@Query() q: CompareQuery) {
    return this.service.compare(q);
  }

  @Post('versions')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND) // BR-DT01-007: chỉ cấp tỉnh lập phiên bản R00.
  @ApiOperation({ summary: 'Tạo phiên bản nháp (DRAFT)' })
  createVersion(@Body() dto: CreateVersionDto, @CurrentUser() user: AuthUser) {
    return this.service.createVersion(dto, user);
  }

  @Post('versions/:id/publish')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Công bố phiên bản (supersede phiên bản trước)' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.publishVersion(id, user);
  }

  @Get('items')
  @ApiOperation({ summary: 'Danh sách mã trong phiên bản' })
  listItems(@Query() q: ItemQuery) {
    return this.service.listItems(q);
  }

  @Get('search')
  @ApiOperation({ summary: 'Tìm theo mã/tên/alias' })
  search(@Query('q') q: string) {
    return this.service.search(q ?? '');
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Chi tiết một mã' })
  getItem(@Param('id') id: string) {
    return this.service.getItem(id);
  }

  @Get('items/:id/children')
  @ApiOperation({ summary: 'Các node con trực tiếp' })
  getChildren(@Param('id') id: string) {
    return this.service.getChildren(id);
  }

  @Post('items')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND) // BR-DT01-007 (TC-DT01-004).
  @ApiOperation({ summary: 'Thêm mã vào phiên bản nháp (parent tồn tại, không vòng lặp, mã duy nhất)' })
  createItem(@Body() dto: CreateItemDto, @CurrentUser() user: AuthUser) {
    return this.service.createItem(dto, user);
  }
}
