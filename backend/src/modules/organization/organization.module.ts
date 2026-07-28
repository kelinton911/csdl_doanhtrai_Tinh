import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrativeArea } from './entities/administrative-area.entity';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';

// M02 — Organization & Area: đơn vị, xã/phường, cơ cấu quản lý, phạm vi địa bàn.
@Module({
  imports: [TypeOrmModule.forFeature([AdministrativeArea])],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
