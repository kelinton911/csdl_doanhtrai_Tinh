import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import {
  BusinessError,
  BusinessException,
  BUSINESS_ERROR_STATUS,
  BUSINESS_ERROR_TITLE,
} from './business-error';
import { ProblemExceptionFilter } from '../filters/problem-exception.filter';

describe('BusinessException (Sprint 0 §2 — mã lỗi nghiệp vụ)', () => {
  it('mọi mã lỗi có status và title mặc định', () => {
    for (const code of Object.values(BusinessError)) {
      expect(BUSINESS_ERROR_STATUS[code]).toBeDefined();
      expect(BUSINESS_ERROR_TITLE[code]).toBeTruthy();
    }
  });

  it('mang đúng code + HTTP status theo bảng §2', () => {
    const ex = new BusinessException(BusinessError.STALE_WRITE);
    expect(ex.getCode()).toBe('STALE_WRITE');
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);

    const scope = new BusinessException(BusinessError.NO_PERMISSION_SCOPE);
    expect(scope.getStatus()).toBe(HttpStatus.FORBIDDEN);

    const noRule = new BusinessException(BusinessError.NO_RULE);
    expect(noRule.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
  });

  it('cho phép ghi đè detail nhưng giữ code', () => {
    const ex = new BusinessException(BusinessError.INSUFFICIENT_STOCK, 'Tồn còn 3, xuất 5');
    const body = ex.getResponse() as { code: string; message: string };
    expect(body.code).toBe('INSUFFICIENT_STOCK');
    expect(body.message).toBe('Tồn còn 3, xuất 5');
  });
});

// TC-S0-006: ném BusinessException → response problem+json đúng code/status.
describe('ProblemExceptionFilter render BusinessException (TC-S0-006)', () => {
  function mockHost(captured: { status?: number; body?: unknown; header?: string }): ArgumentsHost {
    const res = {
      status(code: number) {
        captured.status = code;
        return this;
      },
      setHeader(_k: string, v: string) {
        captured.header = v;
        return this;
      },
      json(payload: unknown) {
        captured.body = payload;
        return this;
      },
    };
    const req = { correlationId: 'corr-123', originalUrl: '/api/v1/x' };
    return {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
    } as unknown as ArgumentsHost;
  }

  it('trả code nghiệp vụ + status + problem+json + correlationId', () => {
    const filter = new ProblemExceptionFilter();
    const captured: { status?: number; body?: any; header?: string } = {};
    filter.catch(new BusinessException(BusinessError.STALE_WRITE), mockHost(captured));

    expect(captured.status).toBe(HttpStatus.CONFLICT);
    expect(captured.header).toContain('application/problem+json');
    expect(captured.body.code).toBe('STALE_WRITE');
    expect(captured.body.status).toBe(HttpStatus.CONFLICT);
    expect(captured.body.correlationId).toBe('corr-123');
  });
});
