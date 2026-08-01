import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { Barracks } from '../barracks/entities/barracks.entity';
import { StorageLocation } from '../inventory/entities/storage-location.entity';
import { AssetCatalogItem } from '../asset-catalog/entities/asset-catalog-item.entity';

// M10 — Tem QR & tra cứu khi quét.
@Module({
  imports: [TypeOrmModule.forFeature([Barracks, StorageLocation, AssetCatalogItem])],
  controllers: [LabelsController],
  providers: [LabelsService],
})
export class LabelsModule {}
