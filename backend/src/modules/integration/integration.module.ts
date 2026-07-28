import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportBatch } from './entities/import-batch.entity';
import { SyncBatch } from './entities/sync-batch.entity';
import { Material } from '../master-data/entities/material.entity';
import { Barracks } from '../barracks/entities/barracks.entity';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';

// M14 — Integration & Sync: nhập CSV hàng loạt + đồng bộ offline.
@Module({
  imports: [TypeOrmModule.forFeature([ImportBatch, SyncBatch, Material, Barracks])],
  controllers: [IntegrationController],
  providers: [IntegrationService],
  exports: [IntegrationService],
})
export class IntegrationModule {}
