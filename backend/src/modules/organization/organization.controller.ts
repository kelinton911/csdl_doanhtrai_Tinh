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
import { OrganizationService } from './organization.service';
import { CreateAreaDto, ListAreaQuery } from './dto/area.dto';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

@ApiTags('Organization & Area (M02)')
@ApiBearerAuth()
@Controller()
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  // ------- Xã/phường -------
  @Get('administrative-areas')
  @ApiOperation({ summary: 'UC-04: Danh sách địa bàn (lọc theo cấp/tỉnh, tìm kiếm)' })
  listAreas(@Query() q: ListAreaQuery) {
    return this.service.listAreas(q);
  }

  @Get('administrative-areas/:id')
  @ApiOperation({ summary: 'UC-04: Chi tiết địa bàn (id, mã, tên, cấp, tỉnh)' })
  getArea(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getArea(id);
  }

  @Post('administrative-areas')
  @Roles(Role.SYS_ADMIN, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-04: Tạo xã/phường' })
  createArea(@Body() dto: CreateAreaDto) {
    return this.service.createArea(dto);
  }

  // ------- Đơn vị -------
  @Get('organizations')
  @ApiOperation({ summary: 'UC-04: Danh sách đơn vị' })
  listOrgs(@Query() q: PaginationQuery) {
    return this.service.listOrganizations(q);
  }

  @Post('organizations')
  @Roles(Role.SYS_ADMIN, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-04: Tạo đơn vị' })
  createOrg(@Body() dto: CreateOrganizationDto) {
    return this.service.createOrganization(dto);
  }

  @Put('organizations/:id')
  @Roles(Role.SYS_ADMIN, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-04: Cập nhật đơn vị' })
  updateOrg(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationDto) {
    return this.service.updateOrganization(id, dto);
  }
}
