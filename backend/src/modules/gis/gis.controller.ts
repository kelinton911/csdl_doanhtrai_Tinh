import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GisService } from './gis.service';

@ApiTags('GIS (M11)')
@ApiBearerAuth()
@Controller('gis')
export class GisController {
  constructor(private readonly service: GisService) {}

  @Get('features')
  @ApiOperation({ summary: 'UC-17: Lấy đối tượng không gian theo lớp + bbox (GeoJSON)' })
  features(@Query('layer') layer = 'barracks', @Query('bbox') bbox?: string) {
    return this.service.features(layer, bbox);
  }

  @Post('search-within')
  @ApiOperation({ summary: 'UC-17: Truy vấn lân cận theo bán kính (mét)' })
  searchWithin(
    @Body() body: { layer?: string; lng: number; lat: number; radiusMeters: number },
  ) {
    return this.service.searchWithin(body);
  }
}
