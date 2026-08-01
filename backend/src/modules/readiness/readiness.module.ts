import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentSite } from './entities/deployment-site.entity';
import { RecoveryTask } from './entities/recovery-task.entity';
import { ReadinessService } from './readiness.service';
import { ReadinessController } from './readiness.controller';

// M18/M19 — Sẵn sàng chiến đấu, bảo đảm tác chiến & khắc phục hậu quả.
@Module({
  imports: [TypeOrmModule.forFeature([DeploymentSite, RecoveryTask])],
  controllers: [ReadinessController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
