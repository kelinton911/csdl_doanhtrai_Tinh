import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunePotential } from './entities/commune-potential.entity';
import { CommunePotentialMaterial } from './entities/commune-potential-material.entity';
import { CommunePotentialService } from './commune-potential.service';
import { CommunePotentialController } from './commune-potential.controller';

// M17 — Tiềm lực Hậu cần - Kỹ thuật khu vực cấp xã.
@Module({
  imports: [TypeOrmModule.forFeature([CommunePotential, CommunePotentialMaterial])],
  controllers: [CommunePotentialController],
  providers: [CommunePotentialService],
  exports: [CommunePotentialService],
})
export class CommunePotentialModule {}
