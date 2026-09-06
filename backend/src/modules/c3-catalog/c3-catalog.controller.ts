import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { C3CatalogService } from './c3-catalog.service';
import { C3Query } from './dto/c3-query.dto';

// Endpoint tra cứu C3 phục vụ ma trận truy vết vận hành (Sprint 0 §8).
@ApiTags('C3 Catalog (Sprint 0 — ma trận truy vết)')
@ApiBearerAuth()
@Controller('c3-catalog')
export class C3CatalogController {
  constructor(private readonly service: C3CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Tra cứu mã C3 (lọc theo phân hệ + từ khóa)' })
  list(@Query() q: C3Query) {
    return this.service.list(q);
  }

  @Get(':code')
  @ApiOperation({ summary: 'Chi tiết một mã C3 (C3 → UC → Entity → API → Screen → Test)' })
  get(@Param('code') code: string) {
    return this.service.getByCode(code);
  }
}
