import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// Log có cấu trúc gắn correlation-id (§5 Hardening). Mỗi request ghi 1 dòng
// method path status durationMs cid=<correlationId> để truy vết xuyên hệ thống.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const http = ctx.switchToHttp();
    const req = http.getRequest<{ method: string; originalUrl?: string; url: string; correlationId?: string }>();
    const start = Date.now();
    const write = (level: 'log' | 'warn') => {
      const res = http.getResponse<{ statusCode: number }>();
      const ms = Date.now() - start;
      const path = req.originalUrl ?? req.url;
      const cid = req.correlationId ?? '-';
      this.logger[level](`${req.method} ${path} ${res.statusCode} ${ms}ms cid=${cid}`);
    };
    return next.handle().pipe(
      tap({
        next: () => write('log'),
        error: () => write('warn'),
      }),
    );
  }
}
