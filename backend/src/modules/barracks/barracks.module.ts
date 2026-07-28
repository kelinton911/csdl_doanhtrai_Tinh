import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barracks } from './entities/barracks.entity';
import { BarracksRevision } from './entities/barracks-revision.entity';
import { BarracksService } from './barracks.service';
import { BarracksController } from './barracks.controller';

// M04 — Barracks: hồ sơ doanh trại, đất, khả năng khai thác, quan hệ quản lý.
@Module({
  imports: [TypeOrmModule.forFeature([Barracks, BarracksRevision])],
  controllers: [BarracksController],
  providers: [BarracksService],
  exports: [BarracksService],
})
export class BarracksModule {}
