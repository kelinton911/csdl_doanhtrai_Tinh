import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogRegistryService } from './catalog-registry.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { SearchQuery } from '../../common/dto/pagination.dto';
import {
  AssignOfficialCodeDto,
  CreateAliasDto,
  CreateChangeRequestDto,
  CreateImportBatchDto,
  CreateReplacementDto,
  CreateTemporaryDto,
  CreateUnitDto,
  MapExistingDto,
  ReviewChangeRequestDto,
  UpdateAliasDto,
} from './dto/catalog.dto';

// DT-01 — ĐVT, alias, mã thay thế, đề nghị bổ sung, mã tạm, lô nhập (Quyển I §XII).
@ApiTags('DT-01 Danh mục chuẩn — Registry')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogRegistryController {
  constructor(private readonly service: CatalogRegistryService) {}

  // ---- Units ----
  @Get('units')
  listUnits(@Query() q: SearchQuery) {
    return this.service.listUnits(q);
  }

  @Post('units')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  createUnit(@Body() dto: CreateUnitDto, @CurrentUser() user: AuthUser) {
    return this.service.createUnit(dto, user);
  }

  // ---- Aliases ----
  @Get('aliases/resolve')
  @ApiOperation({ summary: 'Tra mã chuẩn từ alias (bắt buộc trước khi đề nghị)' })
  resolveAlias(@Query('q') q: string) {
    return this.service.resolveAlias(q ?? '');
  }

  @Get('items/:id/aliases')
  @ApiOperation({ summary: 'Tên khác (alias) của một mã' })
  listAliasesForItem(@Param('id') id: string) {
    return this.service.listAliasesForItem(id);
  }

  @Post('aliases')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER)
  createAlias(@Body() dto: CreateAliasDto, @CurrentUser() user: AuthUser) {
    return this.service.createAlias(dto, user);
  }

  @Put('aliases/:id')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER)
  updateAlias(@Param('id') id: string, @Body() dto: UpdateAliasDto, @CurrentUser() user: AuthUser) {
    return this.service.updateAlias(id, dto, user);
  }

  // ---- Replacements ----
  @Post('replacements')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  createReplacement(@Body() dto: CreateReplacementDto, @CurrentUser() user: AuthUser) {
    return this.service.createReplacement(dto, user);
  }

  @Get('items/:id/replacement')
  @ApiOperation({ summary: 'Cảnh báo mã thay thế (BR-DT01-011)' })
  replacementWarning(@Param('id') id: string) {
    return this.service.replacementWarningFor(id);
  }

  // ---- Change requests (đề nghị bổ sung — đơn vị đề nghị được) ----
  @Get('change-requests')
  @ApiOperation({ summary: 'Danh sách đề nghị bổ sung (hàng chờ chuẩn hóa)' })
  listChangeRequests(@Query() q: SearchQuery & { status?: string }) {
    return this.service.listChangeRequests(q);
  }

  @Post('change-requests')
  @ApiOperation({ summary: 'Tạo đề nghị bổ sung (sau khi đã tra alias)' })
  createChangeRequest(@Body() dto: CreateChangeRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.createChangeRequest(dto, user);
  }

  @Post('change-requests/:id/submit')
  submitChangeRequest(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.submitChangeRequest(id, user);
  }

  @Post('change-requests/:id/review')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER)
  reviewChangeRequest(
    @Param('id') id: string,
    @Body() dto: ReviewChangeRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reviewChangeRequest(id, dto, user);
  }

  @Post('change-requests/:id/map-existing')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER)
  mapExisting(@Param('id') id: string, @Body() dto: MapExistingDto, @CurrentUser() user: AuthUser) {
    return this.service.mapExisting(id, dto, user);
  }

  // ---- Temporary materials ----
  @Get('temporary-materials')
  @ApiOperation({ summary: 'Danh sách mã tạm (hàng chờ chuẩn hóa)' })
  listTemporaries(@Query() q: SearchQuery & { status?: string }) {
    return this.service.listTemporaries(q);
  }

  @Post('temporary-materials')
  @ApiOperation({ summary: 'Tạo mã tạm (cấm bắt đầu R00 — BR-DT01-006)' })
  createTemporary(@Body() dto: CreateTemporaryDto, @CurrentUser() user: AuthUser) {
    return this.service.createTemporary(dto, user);
  }

  @Post('temporary-materials/:id/assign-official-code')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Ánh xạ mã tạm → mã chính thức (có audit)' })
  assignOfficialCode(
    @Param('id') id: string,
    @Body() dto: AssignOfficialCodeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assignOfficialCode(id, dto, user);
  }

  // ---- Import batches ----
  @Post('import-batches')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  createImportBatch(@Body() dto: CreateImportBatchDto, @CurrentUser() user: AuthUser) {
    return this.service.createImportBatch(dto, user);
  }

  @Post('import-batches/:id/validate')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND)
  validateImportBatch(@Param('id') id: string) {
    return this.service.validateImportBatch(id);
  }

  @Get('import-batches/:id/errors')
  getImportErrors(@Param('id') id: string) {
    return this.service.getImportErrors(id);
  }
}
