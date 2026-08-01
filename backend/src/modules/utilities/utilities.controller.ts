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
import { UtilitiesService } from './utilities.service';
import {
  CreateReadingDto,
  CreateUtilitySystemDto,
  DecommissionDto,
  UpdateUtilitySystemDto,
} from './dto/utility.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class UtilityQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() kind?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() barracksId?: string;
}

// M11 — Điện/Nước/Năng lượng.
@ApiTags('Utilities (M11)')
@ApiBearerAuth()
@Controller('utilities')
export class UtilitiesController {
  constructor(private readonly service: UtilitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách hệ thống hạ tầng kỹ thuật (lọc theo nhóm/loại/trạng thái/doanh trại)' })
  list(@Query() q: UtilityQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp khả năng bảo đảm điện/nước/nhiên liệu theo nhóm' })
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem hệ thống hạ tầng kỹ thuật' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/readings')
  @ApiOperation({ summary: 'Lịch sử chỉ số/tiêu thụ/chi phí' })
  readings(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listReadings(id);
  }

  @Post()
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Tạo hệ thống hạ tầng kỹ thuật' })
  create(@Body() dto: CreateUtilitySystemDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Cập nhật hệ thống' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUtilitySystemDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/decommission')
  @Roles(Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Ngừng sử dụng (không xóa cứng)' })
  decommission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DecommissionDto, @CurrentUser() user: AuthUser) {
    return this.service.decommission(id, dto.reason, user);
  }

  @Post(':id/readings')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Ghi chỉ số công tơ/đồng hồ (tự tính tiêu thụ)' })
  addReading(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReadingDto, @CurrentUser() user: AuthUser) {
    return this.service.addReading(id, dto, user);
  }
}
