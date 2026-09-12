import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadinessMaterialPlan } from './entities/readiness-material-plan.entity';
import { ReadinessMaterialLine } from './entities/readiness-material-line.entity';
import { ReadinessMaterialPlanRevision } from './entities/readiness-material-plan-revision.entity';
import { ReadinessAllocationPlan } from './entities/readiness-allocation-plan.entity';
import { ReadinessAllocationLine } from './entities/readiness-allocation-line.entity';
import { ReadinessAllocationPlanRevision } from './entities/readiness-allocation-plan-revision.entity';
import { ReadinessMaterialsService } from './readiness-materials.service';
import { ReadinessMaterialsController } from './readiness-materials.controller';
import { ReadinessAllocationService } from './readiness-allocation.service';
import { ReadinessAllocationController } from './readiness-allocation.controller';

// Trục B — Khai báo & chuyển trạng thái vật chất SSCĐ theo 4 mức (copy-forward + workflow);
// + Feature 03: phương án phân cấp lượng SSCĐ top-down của cấp Tỉnh (3 bảng theo trạng thái).
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReadinessMaterialPlan,
      ReadinessMaterialLine,
      ReadinessMaterialPlanRevision,
      ReadinessAllocationPlan,
      ReadinessAllocationLine,
      ReadinessAllocationPlanRevision,
    ]),
  ],
  controllers: [ReadinessMaterialsController, ReadinessAllocationController],
  providers: [ReadinessMaterialsService, ReadinessAllocationService],
  exports: [ReadinessMaterialsService, ReadinessAllocationService],
})
export class ReadinessMaterialsModule {}
