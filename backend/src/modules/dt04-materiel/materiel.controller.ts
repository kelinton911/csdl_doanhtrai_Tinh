import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaterielService } from './materiel.service';
import { MovementStatus } from './materiel-rules';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { Scoped } from '../../common/scope/scope.decorator';
import {
  CreateAdjustmentDto,
  CreateAssetDto,
  CreateLotDto,
  CreateMovementDto,
  CreateQualityDto,
  CreateSnapshotDto,
} from './dt04.dto';

// DT-04 — Sổ cái thực lực vật chất (Quyển IV §XV). Đặt dưới /materiel để cùng tồn tại
// với module inventory (M06) cũ. Cung cấp HC theo thời điểm cho DT-08.
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER];

@ApiTags('DT-04 Thực lực vật chất')
@ApiBearerAuth()
@Controller('materiel')
export class MaterielController {
  constructor(private readonly service: MaterielService) {}

  // ---- HC theo thời điểm (cho DT-08) ----
  @Get('hc')
  @Scoped('organization')
  @ApiOperation({ summary: 'HC(t) kèm as_of_time/scope/source/locked (BR-DT04-020)' })
  hc(
    @Query('materialCatalogId') materialCatalogId: string,
    @Query('as_of_time') asOf: string,
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.hcAsOf(materialCatalogId, asOf, user, organizationId || undefined);
  }

  // ---- Lots ----
  @Post('lots')
  @Roles(...WRITERS)
  createLot(@Body() dto: CreateLotDto, @CurrentUser() user: AuthUser) {
    return this.service.createLot(dto, user);
  }

  @Get('lots/:id')
  getLot(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getLot(id, user);
  }

  // ---- Assets ----
  @Post('assets')
  @Roles(...WRITERS)
  createAsset(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthUser) {
    return this.service.createAsset(dto, user);
  }

  @Get('assets/by-qr/:value')
  @ApiOperation({ summary: 'Tra tài sản theo mã QR' })
  getByQr(@Param('value') value: string, @CurrentUser() user: AuthUser) {
    return this.service.getAssetByQr(value, user);
  }

  @Get('assets/:id')
  getAsset(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.getAsset(id, user);
  }

  // ---- Movements (state machine) ----
  @Get('movements')
  @Scoped('organization')
  listMovements(
    @CurrentUser() user: AuthUser,
    @Query('materialCatalogId') mat: string,
    @Query('organizationId') org: string,
  ) {
    return this.service.listMovements(mat || undefined, org || undefined, user);
  }

  @Post('movements')
  @Roles(...WRITERS)
  createMovement(@Body() dto: CreateMovementDto, @CurrentUser() user: AuthUser) {
    return this.service.createMovement(dto, user);
  }

  @Post('movements/:id/submit')
  @Roles(...WRITERS)
  submit(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionMovement(id, MovementStatus.SUBMITTED, user);
  }

  @Post('movements/:id/approve')
  @Roles(...WRITERS)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.transitionMovement(id, MovementStatus.APPROVED, user);
  }

  @Post('movements/:id/post')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Ghi sổ (APPROVED→POSTED); chặn tồn âm; phát outbox' })
  post(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.postMovement(id, user);
  }

  @Post('movements/:id/reverse')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Đảo giao dịch POSTED (BR-DT04-004)' })
  reverse(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.reverseMovement(id, user);
  }

  // ---- Quality ----
  @Post('quality-assessments')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Đánh giá chất lượng (Σ cấp ≤ HC lô — BR-DT04-006)' })
  createQuality(@Body() dto: CreateQualityDto, @CurrentUser() user: AuthUser) {
    return this.service.createQuality(dto, user);
  }

  @Get('quality-history/:lotId')
  qualityHistory(@Param('lotId') lotId: string) {
    return this.service.qualityHistory(lotId);
  }

  // ---- Snapshots ----
  @Post('snapshots')
  @Roles(...WRITERS)
  createSnapshot(@Body() dto: CreateSnapshotDto, @CurrentUser() user: AuthUser) {
    return this.service.createSnapshot(dto, user);
  }

  @Post('snapshots/:id/lock')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Khóa snapshot (bất biến — BR-DT04-011)' })
  lockSnapshot(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.lockSnapshot(id, user);
  }

  @Get('snapshots/:id/lines')
  snapshotLines(@Param('id') id: string) {
    return this.service.getSnapshotLines(id);
  }

  @Get('snapshots/:id/reconciliation')
  @ApiOperation({ summary: 'Đối chiếu ledger vs snapshot' })
  reconciliation(@Param('id') id: string) {
    return this.service.reconciliation(id);
  }

  // ---- Adjustments ----
  @Post('adjustments')
  @Roles(...WRITERS)
  createAdjustment(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: AuthUser) {
    return this.service.createAdjustment(dto, user);
  }

  @Post('adjustments/:id/approve')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Duyệt điều chỉnh → sinh giao dịch ADJUSTMENT (SYS-BR-02)' })
  approveAdjustment(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.approveAdjustment(id, user);
  }
}
