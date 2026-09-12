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
import { CommunePotentialService } from './commune-potential.service';
import {
  CreateCommunePotentialDto,
  KvptSummaryQuery,
  ReplacePotentialMaterialsDto,
  ReviewDecisionDto,
  UpdateCommunePotentialDto,
} from './dto/commune-potential.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { Scoped } from '../../common/scope/scope.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class PotentialQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

// Cấp xã khai báo; chỉ huy xã / cấp trên duyệt.
const DECLARERS = [Role.COMMUNE_USER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN];
const APPROVERS = [Role.REVIEWER, Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN];

// M17 — Tiềm lực Hậu cần - Kỹ thuật khu vực cấp xã.
@ApiTags('Commune HC-KT Potential (M17)')
@ApiBearerAuth()
@Controller('commune-potentials')
export class CommunePotentialController {
  constructor(private readonly service: CommunePotentialService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách bản khai tiềm lực HC-KT (lọc theo phạm vi dữ liệu)' })
  list(@Query() q: PotentialQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  // ĐẶT TRƯỚC route ':id' để không bị ParseUUIDPipe bắt nhầm.
  @Get('kvpt-summary')
  @ApiOperation({
    summary: 'Vật chất KVPT: cuộn dòng vật chất của các bản khai ĐÃ DUYỆT theo xã × nguồn × vật chất',
  })
  kvptSummary(@Query() q: KvptSummaryQuery, @CurrentUser() user: AuthUser) {
    return this.service.kvptSummaryByArea({ areaId: q.areaId, catalogGroup: q.catalogGroup }, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết bản khai tiềm lực HC-KT' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user);
  }

  @Get(':id/materials')
  @ApiOperation({ summary: 'Danh sách dòng vật chất tiềm lực (KVPT) của bản khai' })
  listMaterials(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listMaterials(id);
  }

  @Put(':id/materials')
  @Roles(...DECLARERS)
  @Scoped('organization')
  @ApiOperation({ summary: 'Ghi đè danh sách dòng vật chất tiềm lực (bulk upsert)' })
  replaceMaterials(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplacePotentialMaterialsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.replaceMaterials(id, dto, user);
  }

  @Post()
  @Roles(...DECLARERS)
  @Scoped('organization')
  @ApiOperation({ summary: 'Xã khai báo tiềm lực HC-KT khu vực (DRAFT)' })
  create(@Body() dto: CreateCommunePotentialDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(...DECLARERS)
  @Scoped('organization')
  @ApiOperation({ summary: 'Cập nhật bản khai (khi chưa chốt)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommunePotentialDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(...DECLARERS)
  @ApiOperation({ summary: 'Xóa bản khai (chỉ khi DRAFT)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user);
  }

  @Post(':id/submit')
  @Roles(...DECLARERS)
  @ApiOperation({ summary: 'Gửi bản khai vào luồng kiểm duyệt' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Duyệt bản khai (người lập không tự duyệt)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/request-changes')
  @Roles(...APPROVERS)
  @ApiOperation({ summary: 'Yêu cầu bổ sung bản khai' })
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestChanges(id, dto.reason, user);
  }
}
