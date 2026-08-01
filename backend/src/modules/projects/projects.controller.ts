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
import { ProjectsService } from './projects.service';
import {
  CreateMilestoneDto,
  CreateProjectDto,
  SetPhaseDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class ProjectQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() phase?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fundingSource?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() barracksId?: string;
}

// M13 — Xây dựng cơ bản & dự án đầu tư.
@ApiTags('Projects (M13)')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách dự án (lọc theo giai đoạn/loại/nguồn vốn/doanh trại)' })
  list(@Query() q: ProjectQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp đầu tư: dự toán/giải ngân/giai đoạn/chậm tiến độ' })
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem dự án' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Get(':id/milestones')
  @ApiOperation({ summary: 'Nhật ký tiến độ/nghiệm thu/giải ngân của dự án' })
  milestones(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listMilestones(id);
  }

  @Post()
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Tạo dự án (giai đoạn PROPOSAL)' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Cập nhật dự án' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/phase')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Chuyển giai đoạn vòng đời (bàn giao sinh tài sản)' })
  setPhase(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPhaseDto, @CurrentUser() user: AuthUser) {
    return this.service.setPhase(id, dto.phase, user);
  }

  @Post(':id/milestones')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Thêm mốc tiến độ/nghiệm thu/giải ngân' })
  addMilestone(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateMilestoneDto, @CurrentUser() user: AuthUser) {
    return this.service.addMilestone(id, dto, user);
  }

  @Delete(':id/milestones/:milestoneId')
  @Roles(Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND)
  @ApiOperation({ summary: 'Xóa mốc' })
  removeMilestone(@Param('id', ParseUUIDPipe) id: string, @Param('milestoneId', ParseUUIDPipe) milestoneId: string) {
    return this.service.removeMilestone(id, milestoneId);
  }
}
