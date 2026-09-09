import { MetricsService } from './metrics.service';

describe('MetricsService (quan trắc Prometheus)', () => {
  it('ghi nhận http + backlog và scrape ra định dạng Prometheus', async () => {
    const svc = new MetricsService();
    svc.observeHttp('GET', '/api/v1/health', 200, 0.012);
    svc.setOutboxBacklog('PENDING', 3);
    svc.setOutboxBacklog('FAILED', 1);

    const out = await svc.scrape();
    expect(out).toContain('http_request_duration_seconds');
    expect(out).toContain('http_requests_total');
    expect(out).toContain('outbox_backlog{status="PENDING"} 3');
    expect(out).toContain('outbox_backlog{status="FAILED"} 1');
    expect(svc.contentType()).toContain('text/plain');
  });
});
