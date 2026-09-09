import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Lớp quan trắc Prometheus (§5 Hardening). Registry riêng để tách khỏi global mặc định
// và dễ test. Số liệu hệ thống: default (CPU/mem/eventloop) + HTTP latency/throughput +
// backlog outbox (phục vụ alert vận hành: job lỗi/tồn đọng).
@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Thời gian xử lý request theo method/route/status',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [this.registry],
  });

  readonly httpTotal = new Counter({
    name: 'http_requests_total',
    help: 'Tổng số request theo method/route/status',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly outboxBacklog = new Gauge({
    name: 'outbox_backlog',
    help: 'Số sự kiện outbox theo trạng thái (PENDING/FAILED) — tồn đọng/dead-letter',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  observeHttp(method: string, route: string, status: number, seconds: number): void {
    const labels = { method, route, status: String(status) };
    this.httpDuration.observe(labels, seconds);
    this.httpTotal.inc(labels);
  }

  setOutboxBacklog(status: string, count: number): void {
    this.outboxBacklog.set({ status }, count);
  }

  async scrape(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
