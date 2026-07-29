import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Catalog } from './entities/catalog.entity';
import { Material } from './entities/material.entity';
import { MaterialVersion } from './entities/material-version.entity';
import { MasterDataService } from './master-data.service';
import { MasterDataController } from './master-data.controller';

// M03 — Master Data: danh mục dùng chung + danh mục vật chất (phiên bản hóa).
@Module({
  imports: [TypeOrmModule.forFeature([Catalog, Material, MaterialVersion])],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}
