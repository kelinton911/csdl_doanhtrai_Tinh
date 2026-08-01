import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogisticsCalcNorm } from './entities/logistics-calc-norm.entity';
import { LogisticsNormsService } from './logistics-norms.service';
import { LogisticsNormsController } from './logistics-norms.controller';

// Khâu 4 — Định mức/quy ước tính toán HC-KT + engine tính bảo đảm chiến đấu.
@Module({
  imports: [TypeOrmModule.forFeature([LogisticsCalcNorm])],
  controllers: [LogisticsNormsController],
  providers: [LogisticsNormsService],
  exports: [LogisticsNormsService],
})
export class LogisticsNormsModule {}
