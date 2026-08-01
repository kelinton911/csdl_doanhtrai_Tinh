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
import { LocalResourcesService } from './local-resources.service';
import {
  CreateLocalResourceDto,
  DeactivateDto,
  UpdateLocalResourceDto,
} from './dto/local-resource.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class ResourceQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resourceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mobilizationTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reliability?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() agreementStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

// M16 — Nguồn lực huy động tại địa phương.
@ApiTags('Local Resources (M16)')
@ApiBearerAuth()
@Controller('local-resources')
export class LocalResourcesController {
  constructor(private readonly service: LocalResourcesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách nguồn lực huy động (lọc theo loại/thời gian/độ tin cậy/hiệp đồng)' })
  list(@Query() q: ResourceQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Chọn nguồn tối ưu: tìm nguồn lực gần vị trí/doanh trại (sắp theo khoảng cách)' })
  nearby(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('barracksId') barracksId?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('resourceType') resourceType?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.nearby({
      lat: lat ? Number(lat) : undefined,
      lng: lng ? Number(lng) : undefined,
      barracksId: barracksId || undefined,
      radiusKm: radiusKm ? Number(radiusKm) : undefined,
      resourceType: resourceType || undefined,
      category: category || undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem hồ sơ nguồn lực' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Tạo hồ sơ nguồn lực' })
  create(@Body() dto: CreateLocalResourceDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Cập nhật hồ sơ nguồn lực' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocalResourceDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/deactivate')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Ngừng theo dõi (không xóa cứng)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeactivateDto, @CurrentUser() user: AuthUser) {
    return this.service.deactivate(id, dto.reason, user);
  }
}
