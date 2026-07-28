import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Ghi audit cho mọi write operation (Tài liệu Backend §9 — audit append-only).
// Bổ trợ cho ghi audit nghiệp vụ chi tiết mà service tự gọi AuditService.record().
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{
        method: string;
        originalUrl: string;
        params?: Record<string, string>;
        user?: AuthUser;
        correlationId?: string;
      }>();

    if (!MUTATING.has(req.method)) return next.handle();

    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: (body) => {
          const res = context
            .switchToHttp()
            .getResponse<{ statusCode: number }>();
          void this.audit.record({
            actorId: req.user?.sub ?? null,
            actorName: req.user?.username ?? null,
            action: `${req.method} ${req.originalUrl?.split('?')[0]}`,
            entityId:
              req.params?.id ??
              (body && typeof body === 'object' && 'id' in body
                ? String((body as { id: unknown }).id)
                : null),
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            correlationId: req.correlationId ?? null,
            after: { durationMs: Date.now() - started },
          });
        },
      }),
    );
  }
}
