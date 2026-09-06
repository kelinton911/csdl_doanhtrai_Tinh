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
import { ConflictsService } from './conflicts.service';
import { CreateConflictDto, UpdateConflictDto } from './dto/conflict.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// M01-RBAC — Khai báo xung đột tách biệt trách nhiệm (SoD). Chỉ SYS_ADMIN.
@ApiTags('RBAC — Chức vụ & phân quyền (M01)')
@ApiBearerAuth()
@Roles(Role.SYS_ADMIN)
@Controller('rbac/permission-conflicts')
export class ConflictsController {
  constructor(private readonly service: ConflictsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách cặp xung đột SoD' })
  list(@Query() q: PaginationQuery) {
    return this.service.list(q);
  }

  @Post()
  @ApiOperation({ summary: 'Khai báo cặp xung đột SoD' })
  create(@Body() dto: CreateConflictDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật khai báo xung đột' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateConflictDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa khai báo xung đột' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
