import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../../common/outbox/outbox-event.entity';
import { HealthController } from './health.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  controllers: [HealthController],
})
export class HealthModule {}
