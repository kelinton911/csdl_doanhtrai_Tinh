import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { OutboxEvent, OutboxStatus } from '../../common/outbox/outbox-event.entity';
import { StorageService } from '../storage/storage.service';

// Health check tổng hợp (§5 Hardening): DB + PostGIS + object storage + backlog outbox.
// Ngưỡng backlog FAILED > 0 hoặc phụ thuộc down ⇒ degraded (dùng cho readiness/alert vận hành).
@ApiTags('Vận hành')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(OutboxEvent) private readonly outbox: Repository<OutboxEvent>,
    private readonly storage: StorageService,
  ) {}

  // Liveness: tiến trình còn sống (không phụ thuộc hạ tầng ngoài).
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (tiến trình)' })
  live() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  // Readiness/aggregate: kiểm mọi phụ thuộc; degraded nếu có thành phần down/backlog lỗi.
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (DB/PostGIS/MinIO/outbox)' })
  ready() {
    return this.aggregate();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Kiểm tra sức khỏe tổng hợp ứng dụng' })
  check() {
    return this.aggregate();
  }

  private async aggregate() {
    const [database, postgis] = await this.dbChecks();
    const storage = (await this.storage.healthCheck()) ? 'up' : 'down';
    const outbox = await this.outboxBacklog();

    const healthy =
      database === 'up' && postgis === 'up' && storage === 'up' && outbox.failed === 0;
    return {
      status: healthy ? 'ok' : 'degraded',
      service: 'csdl-doanhtrai-backend',
      time: new Date().toISOString(),
      checks: {
        database,
        postgis,
        objectStorage: storage,
        outbox,
      },
    };
  }

  private async dbChecks(): Promise<['up' | 'down', 'up' | 'down']> {
    let database: 'up' | 'down' = 'down';
    let postgis: 'up' | 'down' = 'down';
    try {
      await this.dataSource.query('SELECT 1');
      database = 'up';
      const rows = await this.dataSource.query(
        "SELECT 1 FROM pg_extension WHERE extname = 'postgis'",
      );
      postgis = rows.length > 0 ? 'up' : 'down';
    } catch {
      /* giữ down */
    }
    return [database, postgis];
  }

  private async outboxBacklog(): Promise<{ pending: number; failed: number }> {
    try {
      const [pending, failed] = await Promise.all([
        this.outbox.count({ where: { status: OutboxStatus.PENDING } }),
        this.outbox.count({ where: { status: OutboxStatus.FAILED } }),
      ]);
      return { pending, failed };
    } catch {
      return { pending: -1, failed: -1 };
    }
  }
}
