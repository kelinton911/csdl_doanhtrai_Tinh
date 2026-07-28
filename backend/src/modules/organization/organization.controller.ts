import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationService } from './organization.service';
import { CreateAreaDto } from './dto/area.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

@ApiTags('Organization & Area (M02)')
@ApiBearerAuth()
@Controller('administrative-areas')
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'UC-04: Danh sách xã/phường (phân trang)' })
  list(@Query() q: PaginationQuery) {
    return this.service.listAreas(q);
  }

  @Post()
  @Roles(Role.SYS_ADMIN, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-04: Tạo xã/phường' })
  create(@Body() dto: CreateAreaDto) {
    return this.service.createArea(dto);
  }
}
