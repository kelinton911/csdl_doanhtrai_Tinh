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

// Rút tên thực thể từ đường dẫn REST: /api/v1/<resource>/... → <resource>.
export function deriveEntityType(path: string | undefined): string | null {
  if (!path) return null;
  const clean = path.split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  const vIdx = parts.findIndex((p) => /^v\d+$/.test(p));
  const resource = vIdx >= 0 ? parts[vIdx + 1] : parts[0];
  return resource ?? null;
}

// Ghi audit cho mọi write operation (Sprint 0 §1 GAP-4 — audit append-only chuẩn:
// who/when/action/entity/reason/source/correlation). Bổ trợ cho audit nghiệp vụ
// chi tiết mà service tự gọi AuditService.record() (kèm before/after cụ thể).
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      originalUrl: string;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      headers?: Record<string, string | string[] | undefined>;
      user?: AuthUser;
      correlationId?: string;
    }>();

    if (!MUTATING.has(req.method)) return next.handle();

    const started = Date.now();
    const path = req.originalUrl;
    const reasonHeader = req.headers?.['x-reason'];
    const sourceHeader = req.headers?.['x-source'];
    const reason =
      (typeof req.body?.reason === 'string' ? req.body.reason : undefined) ??
      (typeof reasonHeader === 'string' ? reasonHeader : undefined) ??
      null;
    const source = typeof sourceHeader === 'string' ? sourceHeader : 'api';

    return next.handle().pipe(
      tap({
        next: (body) => {
          const res = context.switchToHttp().getResponse<{ statusCode: number }>();
          void this.audit.record({
            actorId: req.user?.sub ?? null,
            actorName: req.user?.username ?? null,
            action: `${req.method} ${path?.split('?')[0]}`,
            entityType: deriveEntityType(path),
            entityId:
              req.params?.id ??
              (body && typeof body === 'object' && 'id' in body
                ? String((body as { id: unknown }).id)
                : null),
            method: req.method,
            path,
            statusCode: res.statusCode,
            correlationId: req.correlationId ?? null,
            after: {
              durationMs: Date.now() - started,
              reason,
              source,
              scopeOrganizationId: req.user?.organizationId ?? null,
            },
          });
        },
      }),
    );
  }
}
