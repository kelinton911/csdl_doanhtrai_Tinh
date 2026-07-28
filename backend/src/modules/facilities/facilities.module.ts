import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Facility } from './entities/facility.entity';
import { Barracks } from '../barracks/entities/barracks.entity';
import { FacilitiesService } from './facilities.service';
import { FacilitiesController } from './facilities.controller';

// M05 — Facilities: công trình, phòng/khu chức năng, kết cấu, chất lượng, sức chứa.
@Module({
  imports: [TypeOrmModule.forFeature([Facility, Barracks])],
  controllers: [FacilitiesController],
  providers: [FacilitiesService],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
