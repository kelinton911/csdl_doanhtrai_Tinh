import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadinessMaterialPlan } from './entities/readiness-material-plan.entity';
import { ReadinessMaterialLine } from './entities/readiness-material-line.entity';
import { ReadinessMaterialPlanRevision } from './entities/readiness-material-plan-revision.entity';
import { ReadinessMaterialsService } from './readiness-materials.service';
import { ReadinessMaterialsController } from './readiness-materials.controller';

// Trục B — Khai báo & chuyển trạng thái vật chất SSCĐ theo 4 mức (copy-forward + workflow).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReadinessMaterialPlan,
      ReadinessMaterialLine,
      ReadinessMaterialPlanRevision,
    ]),
  ],
  controllers: [ReadinessMaterialsController],
  providers: [ReadinessMaterialsService],
  exports: [ReadinessMaterialsService],
})
export class ReadinessMaterialsModule {}
