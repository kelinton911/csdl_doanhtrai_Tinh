import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { PaginationQuery } from '../../common/dto/pagination.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../identity/roles';

// M15/UC-23 — Quản lý nhật ký và truy nguyên dữ liệu.
@ApiTags('Audit & Operations (M15)')
@ApiBearerAuth()
@Roles(Role.AUDITOR, Role.SYS_ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'UC-23: Tra cứu nhật ký (lọc theo actor/entity/correlation)' })
  list(
    @Query() q: PaginationQuery,
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('correlationId') correlationId?: string,
  ) {
    return this.service.list(q, { actorId, entityType, correlationId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'UC-23: Chi tiết một bản ghi nhật ký' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }
}
