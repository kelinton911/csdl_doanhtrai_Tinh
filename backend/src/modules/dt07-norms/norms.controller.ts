import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NormsService } from './norms.service';
import { CommandStatus } from './norms-rules';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import {
  AddScopesDto,
  CreateAssignmentDto,
  CreateAuthorityRankDto,
  CreateCalculationParameterDto,
  CreateCommandDto,
  CreateCommandVersionDto,
  CreateDocumentVersionDto,
  CreateMaterialNormDto,
  CreateNormativeDocumentDto,
  CreateNormSetDto,
  CreateNormSetVersionDto,
  CreateProgressDto,
  CreateRequirementDto,
  CreateSourceReferenceDto,
  ImportNormsDto,
  ResolveConflictDto,
  ResolveNormDto,
} from './dt07.dto';

// DT-07 — Định mức có căn cứ + bộ chọn deterministic + Chỉ lệnh hậu cần (Quyển VII §XVII).
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];
const APPROVERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.REVIEWER];

@ApiTags('DT-07 Định mức & Chỉ lệnh')
@ApiBearerAuth()
@Controller()
export class NormsController {
  constructor(private readonly service: NormsService) {}

  // ---- Văn bản căn cứ ----
  @Get('normative-documents')
  listDocuments(@Query() q: PaginationQuery) {
    return this.service.listDocuments(q);
  }
  @Post('normative-documents')
  @Roles(...APPROVERS)
  createDocument(@Body() dto: CreateNormativeDocumentDto, @CurrentUser() user: AuthUser) {
    return this.service.createDocument(dto, user);
  }
  @Get('normative-documents/:id/versions')
  listDocumentVersions(@Param('id') id: string) {
    return this.service.listDocumentVersions(id);
  }
  @Post('normative-documents/:id/versions')
  @Roles(...APPROVERS)
  createDocumentVersion(@Param('id') id: string, @Body() dto: CreateDocumentVersionDto, @CurrentUser() user: AuthUser) {
    return this.service.createDocumentVersion(id, dto, user);
  }
  @Get('normative-document-versions/:id/references')
  listReferences(@Param('id') id: string) {
    return this.service.listReferences(id);
  }
  @Post('normative-document-versions/:id/references')
  @Roles(...APPROVERS)
  addReference(@Param('id') id: string, @Body() dto: CreateSourceReferenceDto, @CurrentUser() user: AuthUser) {
    return this.service.addReference(id, dto, user);
  }

  // ---- Bộ định mức + phiên bản ----
  @Get('norm-sets')
  listSets(@Query() q: PaginationQuery) {
    return this.service.listSets(q);
  }
  @Post('norm-sets')
  @Roles(...APPROVERS)
  createSet(@Body() dto: CreateNormSetDto, @CurrentUser() user: AuthUser) {
    return this.service.createSet(dto, user);
  }
  @Get('norm-sets/:id/versions')
  listSetVersions(@Param('id') id: string) {
    return this.service.listSetVersions(id);
  }
  @Post('norm-sets/:id/versions')
  @Roles(...WRITERS)
  createSetVersion(@Param('id') id: string, @Body() dto: CreateNormSetVersionDto, @CurrentUser() user: AuthUser) {
    return this.service.createSetVersion(id, dto, user);
  }

  @Post('norm-set-versions/:id/publish')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Công bố bộ định mức (PUBLISHED bất biến — BR-DT07-002)' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.publishSetVersion(id, user);
  }
  @Get('norm-set-versions/:id/norms')
  listNorms(@Param('id') id: string) {
    return this.service.listNorms(id);
  }
  @Post('norm-set-versions/:id/norms')
  @Roles(...WRITERS)
  addNorm(@Param('id') id: string, @Body() dto: CreateMaterialNormDto, @CurrentUser() user: AuthUser) {
    return this.service.addNorm(id, dto, user);
  }

  // ---- Định mức: scope đa chiều + resolve + import (static trước route động) ----
  @Post('norms/resolve')
  @ApiOperation({ summary: 'Chọn định mức deterministic → SELECTED/NO_RULE/CONFLICT + trace (DT-08)' })
  resolve(@Body() dto: ResolveNormDto, @CurrentUser() user: AuthUser) {
    return this.service.resolve(dto, user);
  }
  @Post('norms/import')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Nhập Excel định mức → DRAFT/LEGACY_UNVERIFIED (BR-DT07-026)' })
  importNorms(@Body() dto: ImportNormsDto, @CurrentUser() user: AuthUser) {
    return this.service.importNorms(dto, user);
  }
  @Post('norms/import-file')
  @Roles(...WRITERS)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Nhập định mức từ file .xlsx/.csv thật → DRAFT/LEGACY (file_hash = sha256)' })
  importNormsFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('normSetVersionId') normSetVersionId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.importNormsFile(file, normSetVersionId || undefined, user);
  }
  @Get('norms/legacy')
  @ApiOperation({ summary: 'Định mức chưa có căn cứ (LEGACY_UNVERIFIED) — cảnh báo, không dùng resolve' })
  listLegacyNorms() {
    return this.service.listLegacyNorms();
  }
  @Post('norms/:id/scopes')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Gắn chiều phạm vi (org/mission/phase…) cho định mức' })
  addScopes(@Param('id') id: string, @Body() dto: AddScopesDto, @CurrentUser() user: AuthUser) {
    return this.service.addScopes(id, dto, user);
  }

  // ---- Xung đột định mức ----
  @Get('norm-conflicts')
  listConflicts(@Query('status') status?: string) {
    return this.service.listConflicts(status);
  }
  @Post('norm-conflicts/:id/resolve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Giải quyết xung đột thủ công (không tự chọn — BR-DT07-008)' })
  resolveConflict(@Param('id') id: string, @Body() dto: ResolveConflictDto, @CurrentUser() user: AuthUser) {
    return this.service.resolveConflict(id, dto, user);
  }

  // ---- Tham số tính toán + xếp hạng cơ quan ----
  @Get('calculation-parameters')
  listParameters() {
    return this.service.listParameters();
  }
  @Post('calculation-parameters')
  @Roles(...APPROVERS)
  createParameter(@Body() dto: CreateCalculationParameterDto, @CurrentUser() user: AuthUser) {
    return this.service.createParameter(dto, user);
  }
  @Get('authority-ranks')
  listAuthorityRanks() {
    return this.service.listAuthorityRanks();
  }
  @Post('authority-ranks')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Tạo phiên bản xếp hạng cơ quan (không hồi tố — BR-DT07-027)' })
  createAuthorityRank(@Body() dto: CreateAuthorityRankDto, @CurrentUser() user: AuthUser) {
    return this.service.createAuthorityRank(dto, user);
  }

  // ---- Chỉ lệnh hậu cần ----
  @Get('commands')
  listCommands(@Query() q: PaginationQuery) {
    return this.service.listCommands(q);
  }
  @Post('commands')
  @Roles(...WRITERS)
  createCommand(@Body() dto: CreateCommandDto, @CurrentUser() user: AuthUser) {
    return this.service.createCommand(dto, user);
  }
  @Get('commands/:id')
  getCommand(@Param('id') id: string) {
    return this.service.getCommand(id);
  }
  @Post('commands/:id/versions')
  @Roles(...WRITERS)
  createCommandVersion(@Param('id') id: string, @Body() dto: CreateCommandVersionDto, @CurrentUser() user: AuthUser) {
    return this.service.createCommandVersion(id, dto, user);
  }
  @Post('commands/:id/issue')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Phát hành chỉ lệnh (ISSUED bất biến)' })
  issueCommand(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionCommand(id, CommandStatus.ISSUED, user);
  }
  @Post('commands/:id/start')
  @Roles(...WRITERS)
  startCommand(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionCommand(id, CommandStatus.IN_PROGRESS, user);
  }
  @Post('commands/:id/complete')
  @Roles(...WRITERS)
  completeCommand(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionCommand(id, CommandStatus.COMPLETED, user);
  }
  @Get('commands/:id/requirements')
  listRequirements(@Param('id') id: string) {
    return this.service.listRequirements(id);
  }
  @Post('commands/:id/requirements')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Thêm yêu cầu vật chất (gắn định mức PUBLISHED tại effective_date — BR-DT07-031)' })
  addRequirement(@Param('id') id: string, @Body() dto: CreateRequirementDto, @CurrentUser() user: AuthUser) {
    return this.service.addRequirement(id, dto, user);
  }
  @Get('command-requirements/:id/assignments')
  listAssignments(@Param('id') id: string) {
    return this.service.listAssignments(id);
  }
  @Post('command-requirements/:id/assignments')
  @Roles(...WRITERS)
  addAssignment(@Param('id') id: string, @Body() dto: CreateAssignmentDto, @CurrentUser() user: AuthUser) {
    return this.service.addAssignment(id, dto, user);
  }
  @Get('command-assignments/:id/progress')
  listProgress(@Param('id') id: string) {
    return this.service.listProgress(id);
  }
  @Post('command-assignments/:id/progress')
  @Roles(...WRITERS)
  addProgress(@Param('id') id: string, @Body() dto: CreateProgressDto, @CurrentUser() user: AuthUser) {
    return this.service.addProgress(id, dto, user);
  }
}
