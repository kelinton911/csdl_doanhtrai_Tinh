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
import { PositionsService } from './positions.service';
import {
  CreatePositionDto,
  SetPositionFunctionsDto,
  UpdatePositionDto,
} from './dto/position.dto';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// M01-RBAC — Quản lý chức vụ và ma trận phân quyền. Chỉ SYS_ADMIN.
@ApiTags('RBAC — Chức vụ & phân quyền (M01)')
@ApiBearerAuth()
@Roles(Role.SYS_ADMIN)
@Controller('rbac/positions')
export class PositionsController {
  constructor(private readonly service: PositionsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách chức vụ (phân trang)' })
  list(@Query() q: PaginationQuery) {
    return this.service.list(q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết chức vụ' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo chức vụ' })
  create(@Body() dto: CreatePositionDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật chức vụ' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePositionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Vô hiệu hóa chức vụ (không xóa cứng)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  // ----- Ma trận phân quyền -----

  @Get(':id/functions')
  @ApiOperation({ summary: 'Ma trận chức năng đã gán cho chức vụ' })
  getFunctions(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getFunctions(id);
  }

  @Put(':id/functions')
  @ApiOperation({ summary: 'Đặt lại ma trận chức năng cho chức vụ (kiểm tra SoD)' })
  setFunctions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPositionFunctionsDto,
  ) {
    return this.service.setFunctions(id, dto);
  }
}
