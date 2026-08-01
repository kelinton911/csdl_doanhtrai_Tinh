import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandParcel } from './entities/land-parcel.entity';
import { LandParcelRevision } from './entities/land-parcel-revision.entity';
import { LandParcelMarker } from './entities/land-parcel-marker.entity';
import { LandParcelsService } from './land-parcels.service';
import { LandParcelsController } from './land-parcels.controller';

// M04 — Hồ sơ khu đất quốc phòng (CRUD + workflow + mốc giới).
@Module({
  imports: [TypeOrmModule.forFeature([LandParcel, LandParcelRevision, LandParcelMarker])],
  controllers: [LandParcelsController],
  providers: [LandParcelsService],
  exports: [LandParcelsService],
})
export class LandParcelsModule {}
