import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerritorialSource } from './entities/territorial-source.entity';
import { SourceMaterial } from './entities/source-material.entity';
import { SourceVerification } from './entities/source-verification.entity';
import { VerificationEvidence } from './entities/verification-evidence.entity';
import { MobilizationAssessment } from './entities/mobilization-assessment.entity';
import { BalancePlan } from './entities/balance-plan.entity';
import { BalanceLine } from './entities/balance-line.entity';
import { SourceReservation } from './entities/source-reservation.entity';
import { ExecutionRequest } from './entities/execution-request.entity';
import { ExecutionFeedback } from './entities/execution-feedback.entity';
import { BalanceSnapshot, BalanceSnapshotLine } from './entities/balance-snapshot.entity';
import { SourceService } from './source.service';
import { BalanceService } from './balance.service';
import { SourceController } from './source.controller';
import { BalanceController } from './balance.controller';
import { Dt08CalculationModule } from '../dt08-calculation/dt08-calculation.module';
import { Dt05DocumentsModule } from '../dt05-documents/dt05-documents.module';

// DT-09 — Nguồn địa bàn & cân đối bảo đảm (Quyển IX). Nhận supply_required từ DT-08 (CalcService),
// bàn giao thực thi qua DT-05 (DocumentsService). Giữ chỗ chống overbooking (row_version).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TerritorialSource, SourceMaterial, SourceVerification, VerificationEvidence,
      MobilizationAssessment, BalancePlan, BalanceLine, SourceReservation,
      ExecutionRequest, ExecutionFeedback, BalanceSnapshot, BalanceSnapshotLine,
    ]),
    Dt08CalculationModule, // CalcService.supplyRequired (nhận NC, không tính lại)
    Dt05DocumentsModule, // DocumentsService.createDocument (execution → chứng từ)
  ],
  controllers: [SourceController, BalanceController],
  providers: [SourceService, BalanceService],
  exports: [SourceService, BalanceService],
})
export class Dt09BalanceModule {}
