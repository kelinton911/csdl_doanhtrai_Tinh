import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditQuery } from './dto/audit-query.dto';
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
  list(@Query() q: AuditQuery) {
    return this.service.list(q, { actorId: q.actorId, entityType: q.entityType, correlationId: q.correlationId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'UC-23: Chi tiết một bản ghi nhật ký' })
  get(@Param('id') id: string) {
    return this.service.get(id);
  }
}
