import { Module } from '@nestjs/common';
import { GisService } from './gis.service';
import { GisController } from './gis.controller';

// M11 — GIS: truy vấn không gian PostGIS trả GeoJSON (UC-17).
@Module({
  controllers: [GisController],
  providers: [GisService],
})
export class GisModule {}
