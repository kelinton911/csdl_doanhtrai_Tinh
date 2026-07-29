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
import { MasterDataService } from './master-data.service';
import {
  CreateCatalogDto,
  CreateMaterialDto,
  ListMaterialsQuery,
  UpdateCatalogDto,
  UpdateMaterialDto,
} from './dto/master-data.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// M03 — Master Data. Danh mục chung (UC-03) và danh mục vật chất (UC-07).
@ApiTags('Master Data (M03)')
@ApiBearerAuth()
@Controller()
export class MasterDataController {
  constructor(private readonly service: MasterDataService) {}

  // ------- Materials (đặt trước route :type để tránh nuốt) -------
  @Get('materials')
  @ApiOperation({ summary: 'UC-07: Danh sách vật chất (lọc nhóm/tìm kiếm)' })
  listMaterials(@Query() q: ListMaterialsQuery) {
    return this.service.listMaterials(q, q.category, q.search);
  }

  @Get('materials/:id/versions')
  @ApiOperation({ summary: 'UC-07: Lịch sử phiên bản vật chất (để đối chiếu/diff)' })
  getMaterialVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getMaterialVersions(id);
  }

  @Get('materials/:id')
  @ApiOperation({ summary: 'UC-07: Chi tiết vật chất' })
  getMaterial(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getMaterial(id);
  }

  @Post('materials')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-07: Tạo vật chất (DRAFT)' })
  createMaterial(@Body() dto: CreateMaterialDto, @CurrentUser() user: AuthUser) {
    return this.service.createMaterial(dto, user);
  }

  @Put('materials/:id')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-07: Cập nhật vật chất (chưa phát hành)' })
  updateMaterial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaterialDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateMaterial(id, dto, user);
  }

  @Post('materials/:id/publish')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-07: Phát hành vật chất' })
  publishMaterial(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.publishMaterial(id, user);
  }

  // ------- Catalog theo loại -------
  @Get('master-data/:type')
  @ApiOperation({ summary: 'UC-03: Danh sách mục danh mục theo loại' })
  listCatalog(@Param('type') type: string, @Query() q: PaginationQuery) {
    return this.service.listCatalog(type, q);
  }

  @Post('master-data/:type')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-03: Tạo mục danh mục (DRAFT)' })
  createCatalog(
    @Param('type') type: string,
    @Body() dto: CreateCatalogDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.createCatalog(type, dto, user);
  }

  @Put('master-data/:type/:id')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-03: Cập nhật mục danh mục (chưa phát hành)' })
  updateCatalog(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateCatalog(type, id, dto, user);
  }

  @Post('master-data/:type/:id/publish')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'UC-03: Phát hành phiên bản danh mục' })
  publishCatalog(
    @Param('type') type: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.publishCatalog(type, id, user);
  }
}
