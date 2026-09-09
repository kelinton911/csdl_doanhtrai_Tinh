import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

// Interceptor toàn cục ghi latency/throughput mỗi request HTTP. Dùng route pattern
// (vd /api/v1/materiel/movements) để giữ cardinality thấp — không dùng URL có id.
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const http = ctx.switchToHttp();
    const req = http.getRequest<{ method: string; route?: { path?: string }; url: string }>();
    const start = process.hrtime.bigint();
    const record = () => {
      const res = http.getResponse<{ statusCode: number }>();
      const route = req.route?.path ?? 'unmatched';
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observeHttp(req.method, route, res.statusCode ?? 0, seconds);
    };
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
