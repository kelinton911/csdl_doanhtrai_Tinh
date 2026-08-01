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
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ReadinessService } from './readiness.service';
import {
  CreateRecoveryDto,
  CreateSiteDto,
  DeactivateDto,
  SetRecoveryStatusDto,
  UpdateRecoveryDto,
  UpdateSiteDto,
} from './dto/readiness.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

const MANAGE = [Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN];

class SiteQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() siteType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() readiness?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() role?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
}
class RecoveryQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() severity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dangerZone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() scenario?: string;
}

// M18/M19 — Sẵn sàng chiến đấu & bảo đảm tác chiến.
@ApiTags('Readiness (M18/M19)')
@ApiBearerAuth()
@Controller('readiness')
export class ReadinessController {
  constructor(private readonly service: ReadinessService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp sẵn sàng: địa điểm bố trí + khắc phục hậu quả' })
  summary() { return this.service.summary(); }

  @Get('assurance-by-area')
  @ApiOperation({ summary: 'M18: Khả năng bảo đảm (sức chứa doanh trại + địa điểm sơ tán) theo địa bàn' })
  assurance() { return this.service.assuranceByArea(); }

  // Địa điểm bố trí/sơ tán (M18)
  @Get('sites')
  @ApiOperation({ summary: 'Danh sách địa điểm sơ tán/phân tán/dự bị/bố trí' })
  listSites(@Query() q: SiteQuery, @CurrentUser() user: AuthUser) { return this.service.listSites(q, q, user); }

  @Get('sites/:id')
  @ApiOperation({ summary: 'Xem địa điểm' })
  getSite(@Param('id', ParseUUIDPipe) id: string) { return this.service.getSite(id); }

  @Post('sites')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Thêm địa điểm bố trí/sơ tán' })
  createSite(@Body() dto: CreateSiteDto, @CurrentUser() user: AuthUser) { return this.service.createSite(dto, user); }

  @Put('sites/:id')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Cập nhật địa điểm' })
  updateSite(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSiteDto, @CurrentUser() user: AuthUser) { return this.service.updateSite(id, dto, user); }

  @Post('sites/:id/deactivate')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Ngừng theo dõi địa điểm (không xóa cứng)' })
  deactivateSite(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeactivateDto, @CurrentUser() user: AuthUser) { return this.service.deactivateSite(id, dto.reason, user); }

  // Khắc phục hậu quả (M19)
  @Get('recovery')
  @ApiOperation({ summary: 'Danh sách nhiệm vụ khắc phục hậu quả/thiệt hại' })
  listRecovery(@Query() q: RecoveryQuery, @CurrentUser() user: AuthUser) { return this.service.listRecovery(q, q, user); }

  @Get('recovery/:id')
  @ApiOperation({ summary: 'Xem nhiệm vụ khắc phục' })
  getRecovery(@Param('id', ParseUUIDPipe) id: string) { return this.service.getRecovery(id); }

  @Post('recovery')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Ghi nhận thiệt hại & lập nhiệm vụ khắc phục' })
  createRecovery(@Body() dto: CreateRecoveryDto, @CurrentUser() user: AuthUser) { return this.service.createRecovery(dto, user); }

  @Put('recovery/:id')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Cập nhật nhiệm vụ khắc phục' })
  updateRecovery(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRecoveryDto, @CurrentUser() user: AuthUser) { return this.service.updateRecovery(id, dto, user); }

  @Post('recovery/:id/status')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Cập nhật trạng thái điều phối khắc phục' })
  setRecoveryStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRecoveryStatusDto, @CurrentUser() user: AuthUser) { return this.service.setRecoveryStatus(id, dto.status, dto.note, user); }
}
