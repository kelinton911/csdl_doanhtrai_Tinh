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
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { OversightService } from './oversight.service';
import {
  CreateFindingDto,
  CreateInspectionDto,
  ResolveFindingDto,
  SetInspectionStatusDto,
  UpdateFindingDto,
  UpdateInspectionDto,
} from './dto/oversight.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

// Kiểm tra/thanh tra do cơ quan có thẩm quyền tiến hành.
const OVERSIGHT = [Role.AUDITOR, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.SYS_ADMIN];
// Khắc phục kiến nghị: thêm đơn vị chịu trách nhiệm (xã).
const RESOLVE = [Role.AUDITOR, Role.PROVINCIAL_COMMAND, Role.BARRACKS_OFFICER, Role.SYS_ADMIN, Role.COMMUNE_USER];

class InspectionQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() inspectionType?: string;
}

// M22 — Kiểm tra, thanh tra & xử lý kiến nghị.
@ApiTags('Inspections & Audits (M22)')
@ApiBearerAuth()
@Controller('inspections')
export class OversightController {
  constructor(private readonly service: OversightService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách cuộc kiểm tra/thanh tra' })
  list(@Query() q: InspectionQuery) {
    return this.service.list(q, q);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp kiểm tra + kiến nghị mở/quá hạn' })
  summary() {
    return this.service.summary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem cuộc kiểm tra + phát hiện/kiến nghị' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @Roles(...OVERSIGHT)
  @ApiOperation({ summary: 'Lập cuộc kiểm tra (PLANNED)' })
  create(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(...OVERSIGHT)
  @ApiOperation({ summary: 'Cập nhật cuộc kiểm tra' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInspectionDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/status')
  @Roles(...OVERSIGHT)
  @ApiOperation({ summary: 'Chuyển trạng thái (tiến hành/lập biên bản/kết thúc/hủy)' })
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetInspectionStatusDto, @CurrentUser() user: AuthUser) {
    return this.service.setStatus(id, dto.status, dto.conclusion, user);
  }

  @Post(':id/findings')
  @Roles(...OVERSIGHT)
  @ApiOperation({ summary: 'Thêm phát hiện/kiến nghị' })
  addFinding(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateFindingDto, @CurrentUser() user: AuthUser) {
    return this.service.addFinding(id, dto, user);
  }

  @Put(':id/findings/:findingId')
  @Roles(...OVERSIGHT)
  @ApiOperation({ summary: 'Sửa phát hiện/kiến nghị' })
  updateFinding(@Param('id', ParseUUIDPipe) id: string, @Param('findingId', ParseUUIDPipe) findingId: string, @Body() dto: UpdateFindingDto) {
    return this.service.updateFinding(id, findingId, dto);
  }

  @Post(':id/findings/:findingId/status/:status')
  @Roles(...RESOLVE)
  @ApiOperation({ summary: 'Theo dõi khắc phục: OPEN|IN_PROGRESS|RESOLVED|ACCEPTED' })
  setFindingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Param('status') status: string,
    @Body() dto: ResolveFindingDto,
  ) {
    return this.service.setFindingStatus(id, findingId, status, dto);
  }

  @Delete(':id/findings/:findingId')
  @Roles(...OVERSIGHT)
  @ApiOperation({ summary: 'Xóa phát hiện' })
  removeFinding(@Param('id', ParseUUIDPipe) id: string, @Param('findingId', ParseUUIDPipe) findingId: string) {
    return this.service.removeFinding(id, findingId);
  }
}
