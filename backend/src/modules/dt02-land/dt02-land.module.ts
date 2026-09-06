import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressSnapshot } from './entities/address-snapshot.entity';
import { LandUsageAllocation } from './entities/land-usage-allocation.entity';
import { LandChangeEvent } from './entities/land-change-event.entity';
import { LandParcel } from '../land-parcels/entities/land-parcel.entity';
import { LandRegistryService } from './land-registry.service';
import { LandRegistryController } from './land-registry.controller';

// DT-02 — Hồ sơ Doanh trại (bổ sung lớp đất: địa chỉ lịch sử, phân bổ hiện trạng, biến động).
@Module({
  imports: [TypeOrmModule.forFeature([AddressSnapshot, LandUsageAllocation, LandChangeEvent, LandParcel])],
  controllers: [LandRegistryController],
  providers: [LandRegistryService],
  exports: [LandRegistryService],
})
export class Dt02LandModule {}
