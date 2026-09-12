import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './entities/import-batch.entity';
import { SyncBatch } from './entities/sync-batch.entity';
import { Material } from '../master-data/entities/material.entity';
import { Barracks } from '../barracks/entities/barracks.entity';
import { Facility } from '../facilities/entities/facility.entity';
import { StorageLocation } from '../inventory/entities/storage-location.entity';
import { MapPoi } from '../gis/entities/map-poi.entity';
import { LandParcel } from '../land-parcels/entities/land-parcel.entity';
import { UtilitySystem } from '../utilities/entities/utility-system.entity';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';

// M14 — Integration & Sync: nhập CSV/Excel hàng loạt (vật chất/doanh trại/khu đất/kho/điện-nước/POI) + đồng bộ offline.
@Module({
  imports: [TypeOrmModule.forFeature([ImportBatch, SyncBatch, Material, Barracks, Facility, StorageLocation, MapPoi, LandParcel, UtilitySystem])],
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
