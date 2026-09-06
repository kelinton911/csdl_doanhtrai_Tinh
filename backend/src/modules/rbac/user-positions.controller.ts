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
import { UserPositionsService } from './user-positions.service';
import {
  CreateUserPositionDto,
  EndUserPositionDto,
} from './dto/user-position.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// M01-RBAC — Bổ nhiệm tài khoản vào chức vụ. Chỉ SYS_ADMIN.
@ApiTags('RBAC — Chức vụ & phân quyền (M01)')
@ApiBearerAuth()
@Roles(Role.SYS_ADMIN)
@Controller('rbac/user-positions')
export class UserPositionsController {
  constructor(private readonly service: UserPositionsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bổ nhiệm của một tài khoản' })
  listByUser(@Query('userId', ParseUUIDPipe) userId: string) {
    return this.service.listByUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Bổ nhiệm tài khoản vào chức vụ' })
  create(@Body() dto: CreateUserPositionDto) {
    return this.service.create(dto);
  }

  @Put(':id/end')
  @ApiOperation({ summary: 'Miễn nhiệm (kết thúc bổ nhiệm)' })
  end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndUserPositionDto) {
    return this.service.end(id, dto);
  }
}
