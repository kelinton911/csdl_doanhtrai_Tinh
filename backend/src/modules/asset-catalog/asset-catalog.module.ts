import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetCatalogItem } from './entities/asset-catalog-item.entity';
import { AssetCatalogService } from './asset-catalog.service';
import { AssetClassifyService } from './asset-classify.service';
import { AssetCatalogController } from './asset-catalog.controller';
import { Material } from '../master-data/entities/material.entity';
import { MaterialVersion } from '../master-data/entities/material-version.entity';
import { Facility } from '../facilities/entities/facility.entity';

// TỔNG DANH MỤC TÀI SẢN NGÀNH DOANH TRẠI (Phụ lục CV 2837/DT-QLDT ngày 16/7/2026).
// Module riêng vì danh mục trải CẢ hai miền nghiệp vụ: công trình (M05) và vật chất (M03/M06).
@Module({
  imports: [TypeOrmModule.forFeature([AssetCatalogItem, Material, MaterialVersion, Facility])],
  controllers: [AssetCatalogController],
  providers: [AssetCatalogService, AssetClassifyService],
  exports: [AssetCatalogService],
})
export class AssetCatalogModule {}
