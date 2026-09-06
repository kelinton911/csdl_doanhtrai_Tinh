import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BusinessError, BusinessException } from '../errors/business-error';
import { isOptimisticLockError } from './optimistic-lock';

// Dịch lỗi optimistic lock của TypeORM (OptimisticLockVersionMismatchError)
// thành BusinessException STALE_WRITE (409, problem+json) — nhất quán toàn hệ thống.
@Injectable()
export class OptimisticLockInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((err) => {
        if (isOptimisticLockError(err)) {
          return throwError(() => new BusinessException(BusinessError.STALE_WRITE));
        }
        return throwError(() => err);
      }),
    );
  }
}
