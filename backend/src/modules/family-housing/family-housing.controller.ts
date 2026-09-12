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
import { FamilyHousingService } from './family-housing.service';
import {
  CreateFamilyHousingDto,
  UpdateFamilyHousingDto,
} from './dto/family-housing.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class FamilyHousingQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() workflowStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
}

// Biểu 01/KK-KGĐ — Khu gia đình quân đội đang quản lý, chưa bàn giao địa phương.
@ApiTags('Family Housing (KK-KGĐ)')
@ApiBearerAuth()
@Controller('family-housing')
export class FamilyHousingController {
  constructor(private readonly service: FamilyHousingService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách khu gia đình (phân trang, lọc)' })
  list(@CurrentUser() user: AuthUser, @Query() q: FamilyHousingQuery) {
    return this.service.list(q, q, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem hồ sơ khu gia đình' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Tạo hồ sơ khu gia đình (DRAFT)' })
  create(@Body() dto: CreateFamilyHousingDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'Cập nhật hồ sơ khu gia đình' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyHousingDto,
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
  requestChanges(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.requestChanges(id, user);
  }
}
