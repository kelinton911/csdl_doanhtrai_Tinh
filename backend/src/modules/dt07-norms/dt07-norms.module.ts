import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NormativeDocument, NormativeDocumentVersion, NormSourceReference } from './entities/normative-document.entity';
import { NormSet, NormSetVersion } from './entities/norm-set.entity';
import { MaterialNorm, NormDimension } from './entities/material-norm.entity';
import { AuthorityRankVersion, CalculationParameter, NormConflictCase, NormSelectorConfig } from './entities/norm-selector.entity';
import { NormImportBatch } from './entities/norm-import.entity';
import { Command, CommandAssignment, CommandProgress, CommandRequirement, CommandVersion } from './entities/command.entity';
import { NormsService } from './norms.service';
import { NormsController } from './norms.controller';

// DT-07 — Định mức có căn cứ + bộ chọn deterministic (/norms/resolve cho DT-08) + Chỉ lệnh hậu cần.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NormativeDocument, NormativeDocumentVersion, NormSourceReference,
      NormSet, NormSetVersion, MaterialNorm, NormDimension,
      CalculationParameter, NormSelectorConfig, AuthorityRankVersion, NormConflictCase, NormImportBatch,
      Command, CommandVersion, CommandRequirement, CommandAssignment, CommandProgress,
    ]),
  ],
  controllers: [NormsController],
  providers: [NormsService],
  exports: [NormsService],
})
export class Dt07NormsModule {}
