import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, from, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyKey } from './idempotency-key.entity';

// Áp cho MỌI endpoint ghi sổ / phát sinh giao dịch (Sprint 0 §1 GAP-6): khi client
// gửi header Idempotency-Key trên POST/PUT/PATCH, gửi lại cùng key ⇒ trả lại kết quả
// đã lưu, không thực thi lại nghiệp vụ (chống trùng do retry mạng).
const IDEMPOTENT_METHODS = new Set(['POST', 'PUT', 'PATCH']);

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<{ method: string; originalUrl: string; headers: Record<string, string> }>();
    const key = req.headers['idempotency-key'];
    if (!IDEMPOTENT_METHODS.has(req.method) || !key) return next.handle();

    const id = `${key}:${req.method}:${req.originalUrl.split('?')[0]}`;
    return from(this.repo.findOne({ where: { id } })).pipe(
      switchMap((existing) => {
        if (existing) return of(existing.response);
        return next.handle().pipe(
          tap((body) => {
            const res = context
              .switchToHttp()
              .getResponse<{ statusCode: number }>();
            void this.repo
              .insert({
                id,
                statusCode: res.statusCode ?? 201,
                response: body as object,
              })
              .catch(() => undefined);
          }),
        );
      }),
    );
  }
}
