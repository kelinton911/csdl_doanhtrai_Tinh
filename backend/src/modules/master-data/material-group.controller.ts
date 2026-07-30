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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MaterialGroupService } from './material-group.service';
import {
  CreateMaterialGroupDto,
  MoveMaterialDto,
  UpdateMaterialGroupDto,
} from './dto/material-group.dto';
import { ListMaterialsQuery } from './dto/master-data.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// Quản lý NHÓM VẬT CHẤT (ngành → nhóm con) — CRUD + liên thông vật chất.
@ApiTags('Nhóm vật chất')
@ApiBearerAuth()
@Controller('material-groups')
export class MaterialGroupController {
  constructor(private readonly service: MaterialGroupService) {}

  @Get()
  @ApiOperation({ summary: 'Cây nhóm vật chất kèm số vật chất trực thuộc (gộp theo nhánh)' })
  tree() {
    return this.service.tree();
  }

  // Đặt trước ':id' để không bị nuốt.
  @Post('move-material')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Chuyển một vật chất sang nhóm khác (đổi nhóm)' })
  moveMaterial(@Body() dto: MoveMaterialDto, @CurrentUser() user: AuthUser) {
    return this.service.moveMaterial(dto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết nhóm vật chất' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.detail(id);
  }

  @Get(':id/materials')
  @ApiOperation({ summary: 'Vật chất trực thuộc nhóm (phân trang, tìm kiếm)' })
  materials(@Param('id', ParseUUIDPipe) id: string, @Query() q: ListMaterialsQuery) {
    return this.service.materialsInGroup(id, q, q.search);
  }

  @Post()
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Tạo nhóm vật chất (cục bộ)' })
  create(@Body() dto: CreateMaterialGroupDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Sửa nhóm (sửa được cả nhóm BQP đã phát hành)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaterialGroupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.BARRACKS_OFFICER, Role.SYS_ADMIN)
  @ApiOperation({ summary: 'Xoá nhóm (chặn nếu còn vật chất hoặc nhóm con)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
