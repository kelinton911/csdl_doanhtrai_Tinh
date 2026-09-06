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
import { FunctionsService } from './functions.service';
import { CreateFunctionDto, UpdateFunctionDto } from './dto/function.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// M01-RBAC — Danh mục chức năng hạt mịn. Chỉ SYS_ADMIN.
@ApiTags('RBAC — Chức vụ & phân quyền (M01)')
@ApiBearerAuth()
@Roles(Role.SYS_ADMIN)
@Controller('rbac/functions')
export class FunctionsController {
  constructor(private readonly service: FunctionsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách chức năng (lọc theo module tùy chọn)' })
  list(@Query() q: PaginationQuery, @Query('module') module?: string) {
    return this.service.list(q, module);
  }

  @Get('all')
  @ApiOperation({ summary: 'Toàn bộ chức năng (dựng ma trận UI)' })
  all() {
    return this.service.all();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo chức năng' })
  create(@Body() dto: CreateFunctionDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật chức năng' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFunctionDto) {
    return this.service.update(id, dto);
  }
}
