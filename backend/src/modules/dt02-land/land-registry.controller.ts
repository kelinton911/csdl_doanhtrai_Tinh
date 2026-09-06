import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LandRegistryService } from './land-registry.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { Scoped } from '../../common/scope/scope.decorator';
import { CreateAddressSnapshotDto, CreateAllocationDto, CreateChangeDto } from './dt02.dto';

// DT-02 — Đất: địa chỉ lịch sử, phân bổ hiện trạng, biến động, diện tích tại snapshot (Quyển II §XIII).
@ApiTags('DT-02 Hồ sơ Doanh trại — Đất')
@ApiBearerAuth()
@Controller('dt02')
export class LandRegistryController {
  constructor(private readonly service: LandRegistryService) {}

  @Get('addresses')
  listAddresses(@Query('ownerType') ownerType: string, @Query('ownerId') ownerId: string) {
    return this.service.listAddressSnapshots(ownerType, ownerId);
  }

  @Post('addresses')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.COMMUNE_USER)
  createAddress(@Body() dto: CreateAddressSnapshotDto, @CurrentUser() user: AuthUser) {
    return this.service.createAddressSnapshot(dto, user);
  }

  @Get('land-points/:id/usage')
  listAllocations(@Param('id') id: string) {
    return this.service.listAllocations(id);
  }

  @Post('land-points/:id/usage')
  @Scoped('organization')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Phân bổ hiện trạng (Σ ≤ diện tích điểm đất — BR-DT02-004)' })
  createAllocation(@Param('id') id: string, @Body() dto: CreateAllocationDto, @CurrentUser() user: AuthUser) {
    return this.service.createAllocation({ ...dto, landPointId: id }, user);
  }

  @Get('land-points/:id/changes')
  listChanges(@Param('id') id: string) {
    return this.service.listChanges(id);
  }

  @Post('land-points/:id/changes')
  @Roles(Role.SYS_ADMIN, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Ghi biến động điểm đất (append-only)' })
  createChange(@Param('id') id: string, @Body() dto: CreateChangeDto, @CurrentUser() user: AuthUser) {
    return this.service.createChange({ ...dto, landPointId: id }, user);
  }

  @Get('land-points/:id/area')
  @ApiOperation({ summary: 'Diện tích điểm đất tại thời điểm (as_of) — bảo toàn số kỳ trước' })
  areaAtSnapshot(@Param('id') id: string, @Query('as_of') asOf: string) {
    return this.service.areaAtSnapshot(id, asOf ?? new Date().toISOString().slice(0, 10));
  }

  @Get('data-quality')
  @ApiOperation({ summary: 'Kiểm tra chất lượng dữ liệu DT-02 (DQ-DT02)' })
  dataQuality() {
    return this.service.dataQuality();
  }
}
