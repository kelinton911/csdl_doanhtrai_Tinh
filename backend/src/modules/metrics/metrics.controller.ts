import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { OutboxEvent, OutboxStatus } from '../../common/outbox/outbox-event.entity';
import { MetricsService } from './metrics.service';

// /metrics công khai (Prometheus scrape). Cập nhật gauge outbox trước khi trả.
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @InjectRepository(OutboxEvent) private readonly outbox: Repository<OutboxEvent>,
  ) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    for (const status of [OutboxStatus.PENDING, OutboxStatus.FAILED]) {
      const count = await this.outbox.count({ where: { status } }).catch(() => 0);
      this.metrics.setOutboxBacklog(status, count);
    }
    return this.metrics.scrape();
  }
}
