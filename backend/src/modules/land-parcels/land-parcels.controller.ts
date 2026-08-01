import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LandParcelsService } from './land-parcels.service';
import {
  CreateLandParcelDto,
  CreateMarkerDto,
  ReviewDecisionDto,
  UpdateLandParcelDto,
} from './dto/land-parcel.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class LandParcelQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() usageStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() disputeStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() legalStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() workflowStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
}

// M04 — Hồ sơ khu đất quốc phòng.
@ApiTags('Land Parcels (M04)')
@ApiBearerAuth()
@Controller('land-parcels')
export class LandParcelsController {
  constructor(private readonly service: LandParcelsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách khu đất (phân trang, lọc, theo phạm vi dữ liệu)' })
  list(@Query() q: LandParcelQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem hồ sơ khu đất (kèm ranh giới/toạ độ GeoJSON)' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Lịch sử phiên bản hồ sơ khu đất' })
  revisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listRevisions(id);
  }

  @Post()
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Tạo hồ sơ khu đất (DRAFT)' })
  create(@Body() dto: CreateLandParcelDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Cập nhật hồ sơ khu đất (nháp/yêu cầu bổ sung)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLandParcelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/submit')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Gửi hồ sơ vào luồng kiểm duyệt' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Phê duyệt hồ sơ (người lập không tự duyệt)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/request-changes')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Yêu cầu bổ sung' })
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestChanges(id, dto, user);
  }

  // ── Mốc giới ────────────────────────────────────────────────
  @Get(':id/markers')
  @ApiOperation({ summary: 'Danh sách mốc giới của khu đất' })
  markers(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listMarkers(id);
  }

  @Post(':id/markers')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Thêm mốc giới' })
  addMarker(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMarkerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addMarker(id, dto, user);
  }

  @Delete(':id/markers/:markerId')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Xóa mốc giới' })
  removeMarker(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('markerId', ParseUUIDPipe) markerId: string,
  ) {
    return this.service.removeMarker(id, markerId);
  }
}
