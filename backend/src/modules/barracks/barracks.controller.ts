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
import { BarracksService } from './barracks.service';
import {
  CreateBarracksDto,
  ReviewDecisionDto,
  UpdateBarracksDto,
} from './dto/barracks.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Barracks (M04)')
@ApiBearerAuth()
@Controller('barracks')
export class BarracksController {
  constructor(private readonly service: BarracksService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách doanh trại (phân trang, kèm tên xã/đơn vị, số công trình)' })
  list(@Query() q: PaginationQuery, @Query('search') search?: string) {
    return this.service.list(q, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem hồ sơ doanh trại' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/revisions')
  @ApiOperation({ summary: 'Lịch sử phiên bản hồ sơ' })
  revisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listRevisions(id);
  }

  @Post()
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-05: Tạo hồ sơ doanh trại (DRAFT)' })
  create(@Body() dto: CreateBarracksDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-05: Cập nhật hồ sơ nháp' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBarracksDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/submit')
  @Roles(Role.COMMUNE_USER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-05: Gửi hồ sơ vào luồng kiểm duyệt' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-06: Phê duyệt hồ sơ (người lập không tự duyệt)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/request-changes')
  @Roles(Role.REVIEWER, Role.BARRACKS_OFFICER)
  @ApiOperation({ summary: 'UC-06: Yêu cầu bổ sung' })
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestChanges(id, dto, user);
  }
}
