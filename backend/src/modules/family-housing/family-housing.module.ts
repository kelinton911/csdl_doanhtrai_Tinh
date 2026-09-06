import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FamilyHousingArea } from './entities/family-housing-area.entity';
import { FamilyHousingService } from './family-housing.service';
import { FamilyHousingController } from './family-housing.controller';

// Biểu 01/KK-KGĐ — Khu gia đình quân đội đang quản lý, chưa bàn giao (CRUD + workflow).
@Module({
  imports: [TypeOrmModule.forFeature([FamilyHousingArea])],
  controllers: [FamilyHousingController],
  providers: [FamilyHousingService],
  exports: [FamilyHousingService],
})
export class FamilyHousingModule {}
