import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scenario } from './entities/scenario.entity';
import { ScenarioRun } from './entities/scenario-run.entity';
import { Plan } from './entities/plan.entity';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';

// M10 — Scenario & Planning: tình huống, engine tính toán, phương án bảo đảm.
@Module({
  imports: [TypeOrmModule.forFeature([Scenario, ScenarioRun, Plan])],
  controllers: [ScenarioController],
  providers: [ScenarioService],
  exports: [ScenarioService],
})
export class ScenarioModule {}
