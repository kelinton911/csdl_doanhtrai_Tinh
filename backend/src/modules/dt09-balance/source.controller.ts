import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SourceService } from './source.service';
import {
  AddSourceMaterialDto,
  AssessMobilizationDto,
  CreateSourceDto,
  SourceQuery,
  UpdateSourceDto,
  VerifyDto,
} from './dto/dt09.dto';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// DT-09 — Nguồn địa bàn: khai báo/xác minh/huy động + candidate 8 bước (Quyển IX §XVIII).
const WRITERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.COMMUNE_USER];
const VERIFIERS = [Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.REVIEWER];

@ApiTags('DT-09 Nguồn địa bàn')
@ApiBearerAuth()
@Controller()
export class SourceController {
  constructor(private readonly service: SourceService) {}

  @Get('territorial-sources')
  list(@Query() q: SourceQuery) {
    return this.service.listSources(q);
  }

  @Post('territorial-sources')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Khai báo nguồn khai thác tại chỗ theo xã/điểm (DT-02)' })
  create(@Body() dto: CreateSourceDto, @CurrentUser() user: AuthUser) {
    return this.service.createSource(dto, user);
  }

  @Get('territorial-sources/:id')
  get(@Param('id') id: string) {
    return this.service.getSource(id);
  }

  @Put('territorial-sources/:id')
  @Roles(...WRITERS)
  update(@Param('id') id: string, @Body() dto: UpdateSourceDto, @CurrentUser() user: AuthUser) {
    return this.service.updateSource(id, dto, user);
  }

  @Get('territorial-sources/:id/materials')
  listMaterials(@Param('id') id: string) {
    return this.service.listMaterials(id);
  }

  @Post('territorial-sources/:id/materials')
  @Roles(...WRITERS)
  @ApiOperation({ summary: 'Khai báo vật chất có thể cung ứng của nguồn' })
  addMaterial(@Param('id') id: string, @Body() dto: AddSourceMaterialDto, @CurrentUser() user: AuthUser) {
    return this.service.addMaterial(id, dto, user);
  }

  @Post('source-materials/:id/verify')
  @Roles(...VERIFIERS)
  @ApiOperation({ summary: 'Xác minh nguồn (UNVERIFIED→VERIFIED→EXPIRED); VERIFIED ≠ ELIGIBLE (BR-001/002)' })
  verify(@Param('id') id: string, @Body() dto: VerifyDto, @CurrentUser() user: AuthUser) {
    return this.service.verify(id, dto, user);
  }

  @Post('source-materials/:id/assess-mobilization')
  @Roles(...VERIFIERS)
  @ApiOperation({ summary: 'Đánh giá huy động (mobilizable ≤ verified; lead_time) (BR-003)' })
  assess(@Param('id') id: string, @Body() dto: AssessMobilizationDto, @CurrentUser() user: AuthUser) {
    return this.service.assessMobilization(id, dto, user);
  }

  @Get('balance-plans/:planId/candidates')
  @ApiOperation({ summary: 'Gợi ý nguồn (8 bước lọc + xếp hạng, có lý do loại) cho một dòng cân đối' })
  candidates(
    @Param('planId') _planId: string,
    @Query('line') line: string,
    @Query('deadlineDays') deadlineDays?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.service.candidates(line, {
      deadlineDays: deadlineDays !== undefined ? Number(deadlineDays) : null,
      radiusKm: radiusKm !== undefined ? Number(radiusKm) : null,
      lat: lat !== undefined ? Number(lat) : undefined,
      lng: lng !== undefined ? Number(lng) : undefined,
    });
  }
}
