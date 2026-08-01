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
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { LegalDocsService } from './legal-docs.service';
import { CreateLegalDocDto, UpdateLegalDocDto } from './dto/legal-document.dto';
import { SearchQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

const MANAGE = [Role.BARRACKS_OFFICER, Role.PROVINCIAL_COMMAND, Role.SYS_ADMIN];

class LegalDocQuery extends SearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() docType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() effectiveStatus?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() field?: string;
}

// M20 — Văn bản, tiêu chuẩn, định mức.
@ApiTags('Legal Documents (M20)')
@ApiBearerAuth()
@Controller('legal-documents')
export class LegalDocsController {
  constructor(private readonly service: LegalDocsService) {}

  @Get()
  @ApiOperation({ summary: 'Tra cứu văn bản (lọc loại/hiệu lực/lĩnh vực; ẩn văn bản độ mật cao theo quyền)' })
  list(@Query() q: LegalDocQuery, @CurrentUser() user: AuthUser) {
    return this.service.list(q, q, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Tổng hợp văn bản: hiệu lực/sắp hết/hết hiệu lực + theo loại' })
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem văn bản + liên kết thay thế' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.service.get(id, user);
  }

  @Post()
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Thêm văn bản' })
  create(@Body() dto: CreateLegalDocDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @Put(':id')
  @Roles(...MANAGE)
  @ApiOperation({ summary: 'Cập nhật văn bản' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLegalDocDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user);
  }
}
