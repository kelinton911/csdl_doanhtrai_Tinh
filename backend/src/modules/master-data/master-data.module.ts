import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from './entities/catalog.entity';
import { Material } from './entities/material.entity';
import { MaterialVersion } from './entities/material-version.entity';
import { AssetCatalogItem } from '../asset-catalog/entities/asset-catalog-item.entity';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';
import { MaterialGroupService } from './material-group.service';
import { MaterialGroupController } from './material-group.controller';

// M03 — Master Data: danh mục dùng chung + danh mục vật chất (phiên bản hóa) +
// quản lý nhóm vật chất (ngành → nhóm con). Đọc AssetCatalogItem để ràng buộc
// định danh vật chất phải chọn từ danh mục chuẩn BQP (quyết định C).
@Module({
  imports: [TypeOrmModule.forFeature([Catalog, Material, MaterialVersion, AssetCatalogItem])],
  controllers: [MasterDataController, MaterialGroupController],
  providers: [MasterDataService, MaterialGroupService],
  exports: [MasterDataService],
})
export class MasterDataModule {}
