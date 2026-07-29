import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GisService } from './gis.service';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('GIS (M11)')
@ApiBearerAuth()
@Controller('gis')
export class GisController {
  constructor(private readonly service: GisService) {}

  @Get('features')
  @ApiOperation({
    summary: 'UC-17: Lấy đối tượng không gian theo lớp (GeoJSON), áp phạm vi dữ liệu',
  })
  @ApiQuery({
    name: 'layer',
    required: false,
    description: 'barracks | facilities | storage-locations | pois | areas | provinces',
  })
  @ApiQuery({ name: 'bbox', required: false, description: 'minLng,minLat,maxLng,maxLat' })
  @ApiQuery({ name: 'simplify', required: false, description: 'Dung sai đơn giản hoá ranh giới (độ)' })
  @ApiQuery({ name: 'province', required: false, description: 'Lọc theo mã tỉnh' })
  features(
    @CurrentUser() user: AuthUser,
    @Query('layer') layer = 'barracks',
    @Query('bbox') bbox?: string,
    @Query('simplify') simplify?: string,
    @Query('province') province?: string,
  ) {
    return this.service.features(layer, { bbox, simplify, province, user });
  }

  @Post('search-within')
  @ApiOperation({ summary: 'UC-17: Truy vấn lân cận theo bán kính (mét) — lớp điểm' })
  searchWithin(
    @CurrentUser() user: AuthUser,
    @Body() body: { layer?: string; lng: number; lat: number; radiusMeters: number },
  ) {
    return this.service.searchWithin({ ...body, user });
  }
}
