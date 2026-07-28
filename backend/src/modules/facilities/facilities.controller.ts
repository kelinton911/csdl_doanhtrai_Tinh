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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FacilitiesService } from './facilities.service';
import {
  CreateFacilityDto,
  DecommissionDto,
  UpdateFacilityDto,
} from './dto/facility.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Facilities (M05)')
@ApiBearerAuth()
@Controller()
export class FacilitiesController {
  constructor(private readonly service: FacilitiesService) {}

  @Get('barracks/:barracksId/facilities')
  @ApiOperation({ summary: 'UC-07: Danh sách công trình thuộc doanh trại' })
  list(
    @Param('barracksId', ParseUUIDPipe) barracksId: string,
    @Query() q: PaginationQuery,
  ) {
    return this.service.listByBarracks(barracksId, q);
  }

  @Post('barracks/:barracksId/facilities')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-07: Tạo công trình trong doanh trại' })
  create(
    @Param('barracksId', ParseUUIDPipe) barracksId: string,
    @Body() dto: CreateFacilityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.create(barracksId, dto, user);
  }

  @Get('facilities/:id')
  @ApiOperation({ summary: 'UC-07: Xem hồ sơ công trình' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Put('facilities/:id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-07: Cập nhật công trình' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFacilityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post('facilities/:id/decommission')
  @Roles(Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-07: Ngừng khai thác (không xóa cứng)' })
  decommission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecommissionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.decommission(id, dto, user);
  }
}
