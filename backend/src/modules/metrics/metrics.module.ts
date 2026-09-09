import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from '../../common/outbox/outbox-event.entity';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

// Global: MetricsService dùng bởi MetricsInterceptor (đăng ký APP_INTERCEPTOR ở AppModule).
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
