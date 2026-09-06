import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TechnicalService } from './technical.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { SearchQuery } from '../../common/dto/pagination.dto';
import {
  CreateAttributeDto,
  CreateBomDto,
  CreateBomItemDto,
  CreateCatalogLinkDto,
  CreateDocumentDto,
  CreateModelDto,
  CreateRelationshipDto,
  CreateRevisionDto,
  CreateSheetDto,
  TransitionRevisionDto,
  VerifyDto,
} from './dt03.dto';

// DT-03 — Hồ sơ kỹ thuật vật chất (Quyển III §XII). Ghi mã kỹ thuật đòi vai trò chuyên môn.
const TECH_WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];

@ApiTags('DT-03 Hồ sơ kỹ thuật')
@ApiBearerAuth()
@Controller()
export class TechnicalController {
  constructor(private readonly service: TechnicalService) {}

  // ---- Models ----
  @Get('technical-models')
  listModels(@Query() q: SearchQuery) {
    return this.service.listModels(q);
  }

  @Post('technical-models')
  @Roles(...TECH_WRITERS)
  createModel(@Body() dto: CreateModelDto, @CurrentUser() user: AuthUser) {
    return this.service.createModel(dto, user);
  }

  @Get('technical-models/by-catalog/:catalogId')
  @ApiOperation({ summary: '1 R00 ↔ N mẫu (BR-DT03-002)' })
  modelsByCatalog(@Param('catalogId') catalogId: string) {
    return this.service.modelsByCatalog(catalogId);
  }

  @Get('technical-models/:id')
  getModel(@Param('id') id: string) {
    return this.service.getModel(id);
  }

  @Post('technical-models/:id/catalog-links')
  @Roles(...TECH_WRITERS)
  createCatalogLink(@Param('id') id: string, @Body() dto: CreateCatalogLinkDto, @CurrentUser() user: AuthUser) {
    return this.service.createCatalogLink(id, dto, user);
  }

  @Get('technical-models/:id/revisions')
  listRevisions(@Param('id') id: string) {
    return this.service.listRevisions(id);
  }

  @Post('technical-models/:id/revisions')
  @Roles(...TECH_WRITERS)
  createRevision(@Param('id') id: string, @Body() dto: CreateRevisionDto, @CurrentUser() user: AuthUser) {
    return this.service.createRevision(id, dto, user);
  }

  // ---- Revisions (compare TRƯỚC route động) ----
  @Get('revisions/compare')
  @ApiOperation({ summary: 'So sánh thông số 2 revision (2016 ↔ K24)' })
  compare(@Query('from') from: string, @Query('to') to: string) {
    return this.service.compareRevisions(from, to);
  }

  @Get('revisions/:id')
  getRevision(@Param('id') id: string) {
    return this.service.getRevision(id);
  }

  @Post('revisions/:id/transition')
  @Roles(...TECH_WRITERS)
  transition(@Param('id') id: string, @Body() dto: TransitionRevisionDto, @CurrentUser() user: AuthUser) {
    return this.service.transitionRevision(id, dto.to, user);
  }

  @Post('revisions/:id/publish')
  @Roles(...TECH_WRITERS)
  @ApiOperation({ summary: 'Công bố revision (VERIFIED→PUBLISHED, supersede đời cũ)' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.publishRevision(id, user);
  }

  @Post('revisions/:id/documents')
  @Roles(...TECH_WRITERS)
  @ApiOperation({ summary: 'Thêm văn bản/bộ bản vẽ (trùng hash → cảnh báo)' })
  addDocument(@Param('id') id: string, @Body() dto: CreateDocumentDto, @CurrentUser() user: AuthUser) {
    return this.service.addDocument(id, dto, user);
  }

  @Post('revisions/:id/specifications')
  @Roles(...TECH_WRITERS)
  addAttribute(@Param('id') id: string, @Body() dto: CreateAttributeDto, @CurrentUser() user: AuthUser) {
    return this.service.addAttribute(id, dto, user);
  }

  @Post('revisions/:id/boms')
  @Roles(...TECH_WRITERS)
  createBom(@Param('id') id: string, @Body() dto: CreateBomDto, @CurrentUser() user: AuthUser) {
    return this.service.createBom(id, dto, user);
  }

  @Get('technical-completeness/:revisionId')
  @ApiOperation({ summary: 'Độ đầy đủ hồ sơ (INCOMPLETE/PARTIAL/COMPLETE_VERIFIED)' })
  completeness(@Param('revisionId') revisionId: string) {
    return this.service.completeness(revisionId);
  }

  // ---- Documents / sheets ----
  @Post('documents/:id/sheets')
  @Roles(...TECH_WRITERS)
  addSheet(@Param('id') id: string, @Body() dto: CreateSheetDto, @CurrentUser() user: AuthUser) {
    return this.service.addSheet(id, dto, user);
  }

  // ---- BOM ----
  @Post('boms/:id/items')
  @Roles(...TECH_WRITERS)
  addBomItem(@Param('id') id: string, @Body() dto: CreateBomItemDto, @CurrentUser() user: AuthUser) {
    return this.service.addBomItem(id, dto, user);
  }

  @Get('boms/:id/export')
  exportBom(@Param('id') id: string) {
    return this.service.exportBom(id);
  }

  // ---- Verification ----
  @Post('verification/:entityType/:id')
  @Roles(...TECH_WRITERS)
  @ApiOperation({ summary: 'Xác minh dữ liệu nguồn → VERIFIED + ghi provenance' })
  verify(
    @Param('entityType') entityType: string,
    @Param('id') id: string,
    @Body() dto: VerifyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.verify(entityType, id, dto, user);
  }

  @Post('attributes/:id/use-as-criterion')
  @ApiOperation({ summary: 'Dùng thông số làm tiêu chí — chỉ khi VERIFIED (BR-DT03-006)' })
  useAsCriterion(@Param('id') id: string) {
    return this.service.useAttributeAsCriterion(id);
  }

  // ---- Relationships ----
  @Post('model-relationships')
  @Roles(...TECH_WRITERS)
  @ApiOperation({ summary: 'Quan hệ thay thế/tương đương (không vòng lặp — BR-DT03-013)' })
  createRelationship(@Body() dto: CreateRelationshipDto, @CurrentUser() user: AuthUser) {
    return this.service.createRelationship(dto, user);
  }
}
