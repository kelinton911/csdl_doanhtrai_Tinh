import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEvent, OutboxStatus } from './outbox-event.entity';
import { OutboxEmitter } from './outbox.emitter';

const POLL_MS = 5000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

// Dispatcher đọc sự kiện PENDING và phát ra ngoài, đánh dấu PUBLISHED. Chạy nền
// theo chu kỳ; chống chạy chồng bằng cờ `running`. (Khởi tạo — Sprint 0 GAP-7.)
@Injectable()
export class OutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Outbox');
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    @InjectRepository(OutboxEvent)
    private readonly repo: Repository<OutboxEvent>,
    private readonly emitter: OutboxEmitter,
  ) {}

  onModuleInit(): void {
    // Không bật poller khi chạy test (tránh treo tiến trình jest).
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.dispatchPending(), POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // Một lượt quét: lấy batch PENDING, phát từng sự kiện, cập nhật trạng thái.
  async dispatchPending(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let published = 0;
    try {
      const pending = await this.repo.find({
        where: { status: OutboxStatus.PENDING },
        order: { occurredAt: 'ASC' },
        take: BATCH_SIZE,
      });
      for (const event of pending) {
        try {
          await this.emitter.publish(event);
          event.status = OutboxStatus.PUBLISHED;
          event.publishedAt = new Date();
          event.lastError = null;
          await this.repo.save(event);
          published += 1;
        } catch (err) {
          event.attempts += 1;
          event.lastError = (err as Error).message;
          if (event.attempts >= MAX_ATTEMPTS) event.status = OutboxStatus.FAILED;
          await this.repo.save(event);
          this.logger.warn(
            `Phát outbox ${event.eventType} thất bại (lần ${event.attempts}): ${event.lastError}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
    return published;
  }
}
